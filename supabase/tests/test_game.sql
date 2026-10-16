-- Kiểm thử luật game phía máy chủ (chạy bằng: npm run test:sql).
-- Mỗi khối DO là một tình huống; ASSERT sai → dừng và báo lỗi.
\set ON_ERROR_STOP 1
set client_min_messages = warning;

-- Tắt Giờ Vàng để kết quả không phụ thuộc giờ chạy test.
update game_settings set value = jsonb_set(value, '{RANGES}', '[]') where key = 'GOLDEN_HOURS';

create or replace function test_as(p_uid uuid) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', coalesce(p_uid::text, ''), false);
  if p_uid is not null then execute 'set role authenticated'; end if;
end $$;
create or replace function test_admin() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', false);
end $$;
create or replace function test_expect_error(p_sql text, p_msg text) returns void language plpgsql as $$
declare v_err text := null;
begin
  begin
    execute p_sql;
  exception when others then
    v_err := sqlerrm;
  end;
  if v_err is null then
    raise exception 'Mong đợi lỗi "%" nhưng không có lỗi: %', p_msg, p_sql;
  elsif v_err not like '%' || p_msg || '%' then
    raise exception 'Mong đợi lỗi "%" nhưng nhận "%"', p_msg, v_err;
  end if;
end $$;
grant execute on function test_as(uuid), test_admin(), test_expect_error(text, text) to authenticated;

-- Ba tài khoản: A, B thuộc trường; C dùng Gmail (không được chơi).
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'cola@vaschools.edu.vn', '{"full_name":"Nguyễn Thị Lan"}'),
  ('00000000-0000-0000-0000-00000000000b', 'minh@vaschools.edu.vn', '{"full_name":"Trần Minh"}'),
  ('00000000-0000-0000-0000-00000000000c', 'hacker@gmail.com', '{}');

\echo '1. Tạo hồ sơ + trạng thái ban đầu'
do $$
declare s jsonb;
begin
  perform test_as('00000000-0000-0000-0000-00000000000a');
  s := get_my_state();
  assert (s ->> 'coins')::int = 50, 'xu ban đầu = 50';
  assert (s ->> 'xp')::int = 0, 'xp ban đầu = 0';
  assert s -> 'owned' ? 'jacket-va', 'có áo khoác VA';
  assert s -> 'equipped' ->> 'jacket' = 'jacket-va', 'mặc áo VA';
  assert s -> 'profile' ->> 'house' is not null, 'được xếp Nhà';
  assert jsonb_array_length(s -> 'daily' -> 'missions') = 3, '3 nhiệm vụ/ngày';
  s := update_profile('  Cô   Lan ', 'Tổ Toán') -> 'state';
  assert s -> 'profile' ->> 'displayName' = 'Cô Lan', 'chuẩn hoá tên hiển thị';
  perform test_expect_error($q$select update_profile('A', 'X')$q$, 'invalid_display_name');
end $$;

\echo '2. Email ngoài trường bị chặn'
do $$
begin
  perform test_as('00000000-0000-0000-0000-00000000000c');
  perform test_expect_error('select get_my_state()', 'email_domain_not_allowed');
  perform test_as(null);
  perform test_expect_error('select get_my_state()', 'not_authenticated');
end $$;

\echo '3. Không đọc được đáp án, không ghi thẳng vào bảng'
do $$
declare n int;
begin
  perform test_as('00000000-0000-0000-0000-00000000000a');
  select count(*) into n from questions;
  assert n = 0, 'người chơi không đọc được bảng câu hỏi (có đáp án)';
  select count(*) into n from question_tickets;
  assert n = 0, 'không đọc được vé câu hỏi';
  perform test_expect_error($q$update player_state set coins = 99999$q$, 'permission denied');
  perform test_expect_error($q$select _apply_reward(auth.uid(), 1000, 1000, 'hack')$q$, 'permission denied');
end $$;

\echo '4. Điểm danh: 1 lần/ngày, chuỗi ngày'
do $$
declare r jsonb;
begin
  perform test_as('00000000-0000-0000-0000-00000000000a');
  r := claim_checkin();
  assert (r -> 'result' ->> 'xp')::int = 20, 'điểm danh +20 XP';
  assert (r -> 'result' ->> 'coins')::int = 17, 'điểm danh 15 + 2 chuỗi = 17 Xu';
  assert (r -> 'state' -> 'streak' ->> 'count')::int = 1, 'chuỗi 1 ngày';
  r := claim_checkin();
  assert r -> 'result' = 'null'::jsonb, 'không điểm danh 2 lần';
  -- Hôm qua đã điểm danh → hôm nay chuỗi = 2.
  perform test_admin();
  update player_state set streak_count = 5, streak_last = _today() - 1 where user_id = '00000000-0000-0000-0000-00000000000b';
  perform test_as('00000000-0000-0000-0000-00000000000b');
  r := claim_checkin();
  assert (r -> 'result' ->> 'streak')::int = 6, 'chuỗi tiếp tục = 6';
  assert (r -> 'result' ->> 'coins')::int = 15 + 6 * 2, 'thưởng chuỗi 6 ngày';
end $$;

\echo '5. Quiz: đáp án chỉ máy chủ biết, chấm điểm đúng'
do $$
declare
  r jsonb; q jsonb; res jsonb; v_round uuid; v_idx int; i int := 0; v_before int;
begin
  perform test_as('00000000-0000-0000-0000-00000000000a');
  v_before := (get_my_state() ->> 'xp')::int;
  r := start_quiz_round();
  v_round := (r ->> 'roundId')::uuid;
  assert (r ->> 'rewarded')::boolean, 'lượt đầu có thưởng';
  assert jsonb_array_length(r -> 'questions') = 5, '5 câu hỏi';
  assert not (r -> 'questions' -> 0 ? 'correctIndex'), 'không lộ đáp án';
  for q in select * from jsonb_array_elements(r -> 'questions') loop
    perform test_admin();
    select correct_index into v_idx from question_tickets where id = (q ->> 'ticketId')::uuid;
    perform test_as('00000000-0000-0000-0000-00000000000a');
    -- 3 câu đúng, 2 câu sai.
    res := answer_ticket((q ->> 'ticketId')::uuid, case when i < 3 then v_idx else (v_idx + 1) % 4 end);
    assert (res ->> 'correct')::boolean = (i < 3), 'chấm đúng/sai';
    assert (res ->> 'correctIndex')::int = v_idx, 'trả về đáp án sau khi trả lời';
    i := i + 1;
  end loop;
  perform test_expect_error(format('select answer_ticket(%L, 0)', r -> 'questions' -> 0 ->> 'ticketId'), 'already_answered');
  res := finish_quiz_round(v_round);
  assert (res -> 'result' ->> 'xp')::int = 3 * 10 + 2 * 2, 'XP quiz = 34';
  assert (res -> 'result' ->> 'coins')::int = 15, 'Xu quiz = 15';
  assert (res -> 'state' ->> 'xp')::int = v_before + 34, 'XP cộng vào tài khoản';
  perform test_expect_error(format('select finish_quiz_round(%L)', v_round), 'already_finished');
  -- Hết lượt có thưởng sau 3 lượt.
  perform start_quiz_round(); perform start_quiz_round();
  r := start_quiz_round();
  assert not (r ->> 'rewarded')::boolean, 'lượt thứ 4 không có thưởng';
end $$;

\echo '6. Câu hỏi dọc đường: phải chạy đủ quãng đường thật'
do $$
declare r jsonb; v_idx int;
begin
  perform test_as('00000000-0000-0000-0000-00000000000a');
  perform test_expect_error($q$select issue_question('run')$q$, 'not_enough_distance');
  r := add_distance(1000);
  assert (r ->> 'added')::numeric < 60, 'không thể chạy 1000 m trong vài giây';
  perform test_admin();
  update daily_counters set last_distance_at = now() - interval '60 seconds' where user_id = '00000000-0000-0000-0000-00000000000a';
  perform test_as('00000000-0000-0000-0000-00000000000a');
  r := add_distance(150);
  assert (r ->> 'added')::numeric = 150, 'chạy 150 m trong 60 giây hợp lệ';
  r := issue_question('run');
  assert r ? 'ticketId', 'được phát câu hỏi dọc đường';
  perform test_admin();
  select correct_index into v_idx from question_tickets where id = (r ->> 'ticketId')::uuid;
  perform test_as('00000000-0000-0000-0000-00000000000a');
  r := answer_ticket((r ->> 'ticketId')::uuid, v_idx);
  assert (r -> 'reward' ->> 'xp')::int = 5 and (r -> 'reward' ->> 'coins')::int = 3, 'thưởng câu dọc đường';
  perform test_expect_error($q$select issue_question('run')$q$, 'not_enough_distance');
end $$;

\echo '7. Cột Vùng Đất: 1 lần/cột/ngày, đủ 5 vùng có thưởng Nhà thám hiểm'
do $$
declare r jsonb; st text; v_idx int; v_all jsonb;
begin
  foreach st in array array['nhanAi', 'banLinh', 'triThuc', 'trachNhiem', 'khaiPhong'] loop
    perform test_as('00000000-0000-0000-0000-00000000000b');
    r := issue_question('station', st);
    perform test_admin();
    select correct_index into v_idx from question_tickets where id = (r ->> 'ticketId')::uuid;
    perform test_as('00000000-0000-0000-0000-00000000000b');
    r := answer_ticket((r ->> 'ticketId')::uuid, v_idx);
    assert (r -> 'reward' ->> 'xp')::int = 10, 'thưởng cột ' || st;
    v_all := r -> 'reward' -> 'allStations';
  end loop;
  assert (v_all ->> 'xp')::int = 25, 'thưởng Nhà thám hiểm khi đủ 5 vùng';
  r := issue_question('station', 'triThuc');
  assert (r ->> 'done')::boolean, 'cột đã ghé thì không phát câu hỏi nữa';
  perform test_expect_error($q$select issue_question('station', 'hack')$q$, 'invalid_station');
end $$;

\echo '8. Xu & hộp quà: giới hạn tốc độ và số lượng'
do $$
declare r jsonb;
begin
  perform test_as('00000000-0000-0000-0000-00000000000b');
  r := collect_coin();
  assert (r ->> 'ok')::boolean, 'nhặt xu';
  r := collect_coin();
  assert not (r ->> 'ok')::boolean, 'nhặt xu quá nhanh bị chặn';
  r := open_gift();
  assert r -> 'result' ->> 'kind' in ('coins', 'xp', 'item', 'voucher'), 'mở hộp quà';
  r := open_gift();
  assert r -> 'result' = 'null'::jsonb, 'mở quà liên tục bị chặn';
end $$;

\echo '9. Mua & mặc đồ'
do $$
declare r jsonb;
begin
  perform test_as('00000000-0000-0000-0000-00000000000a');
  perform test_admin();
  update player_state set coins = 10 where user_id = '00000000-0000-0000-0000-00000000000a';
  perform test_as('00000000-0000-0000-0000-00000000000a');
  perform test_expect_error($q$select buy_item('hat-grad')$q$, 'not_enough_coins');
  perform test_expect_error($q$select buy_item('hat-crown')$q$, 'item_not_buyable');
  perform test_expect_error($q$select equip_item('hat-grad')$q$, 'not_owned');
  perform test_admin();
  update player_state set coins = 500 where user_id = '00000000-0000-0000-0000-00000000000a';
  perform test_as('00000000-0000-0000-0000-00000000000a');
  r := buy_item('hat-grad');
  assert (r -> 'state' ->> 'coins')::int = 250, 'trừ 250 Xu';
  r := equip_item('hat-grad');
  assert r -> 'state' -> 'equipped' ->> 'hat' = 'hat-grad', 'đội mũ tốt nghiệp';
  perform test_expect_error($q$select buy_item('hat-grad')$q$, 'already_owned');
end $$;

\echo '10. Lên hạng + đồ thưởng hạng'
do $$
declare r jsonb;
begin
  perform test_admin();
  update player_state set xp = 296 where user_id = '00000000-0000-0000-0000-00000000000a';
  perform test_as('00000000-0000-0000-0000-00000000000a');
  r := add_distance(0);
  perform test_admin();
  update daily_counters set distance = 0, distance_at_run_q = 0, last_distance_at = now() - interval '60 seconds'
    where user_id = '00000000-0000-0000-0000-00000000000a';
  update daily_counters set distance = 200 where user_id = '00000000-0000-0000-0000-00000000000a';
  perform test_as('00000000-0000-0000-0000-00000000000a');
  r := issue_question('run');
  perform test_admin();
  r := jsonb_build_object('t', r ->> 'ticketId', 'i', (select correct_index from question_tickets where id = (r ->> 'ticketId')::uuid));
  perform test_as('00000000-0000-0000-0000-00000000000a');
  r := answer_ticket((r ->> 't')::uuid, (r ->> 'i')::int);
  assert r -> 'reward' -> 'rankUp' -> 'to' ->> 'id' = 'thanhVien', 'lên hạng Thành Viên';
  assert r -> 'state' -> 'owned' ? 'backpack-black', 'nhận ba lô đen';
end $$;

\echo '11. Nhân Ái: thả tim, lời cảm ơn'
do $$
declare r jsonb; v_b_coins int;
begin
  perform test_admin();
  select coins into v_b_coins from player_state where user_id = '00000000-0000-0000-0000-00000000000b';
  perform test_as('00000000-0000-0000-0000-00000000000a');
  perform test_expect_error($q$select send_kudos('00000000-0000-0000-0000-00000000000a', 'heart')$q$, 'cannot_kudos_self');
  r := send_kudos('00000000-0000-0000-0000-00000000000b', 'thanks', 'Cảm ơn em đã giúp cô!');
  assert (r ->> 'ok')::boolean and (r -> 'reward' ->> 'coins')::int = 5, 'người gửi +5 Xu';
  r := send_kudos('00000000-0000-0000-0000-00000000000b', 'thanks', 'Lần 2');
  assert r ->> 'reason' = 'already', 'mỗi người 1 lời cảm ơn/ngày';
  r := send_kudos('00000000-0000-0000-0000-00000000000b', 'heart');
  assert (r ->> 'ok')::boolean, 'thả tim';
  perform test_admin();
  assert (select coins from player_state where user_id = '00000000-0000-0000-0000-00000000000b') = v_b_coins + 5, 'người nhận +5 Xu';
  perform test_as('00000000-0000-0000-0000-00000000000b');
  r := public_profile('00000000-0000-0000-0000-00000000000a');
  assert r ->> 'displayName' = 'Cô Lan', 'hồ sơ công khai';
  assert not (r ? 'email'), 'không lộ email';
  r := my_kudos();
  assert exists (select 1 from jsonb_array_elements(r) e where e ->> 'kind' = 'thanks' and e ->> 'message' = 'Cảm ơn em đã giúp cô!'), 'nhận lời cảm ơn';
  r := public_profiles(array['00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b']::uuid[]);
  assert jsonb_array_length(r) = 2, 'thông tin bảng tên';
end $$;

\echo '12. Bảng xếp hạng & 5 Nhà'
do $$
declare r jsonb;
begin
  perform test_as('00000000-0000-0000-0000-00000000000b');
  r := leaderboard('week');
  assert jsonb_array_length(r -> 'rows') = 2, 'BXH tuần có 2 người';
  assert (r -> 'rows' -> 0 ->> 'pos')::int = 1, 'hạng 1';
  assert r -> 'me' ? 'pos', 'vị trí của tôi';
  r := leaderboard('all', 'Tổ Toán');
  assert jsonb_array_length(r -> 'rows') = 1, 'lọc theo bộ phận';
  r := house_standings();
  assert jsonb_array_length(r -> 'standings') = 5, '5 Nhà';
end $$;

\echo '13. Nhiệm vụ ngày + rương'
do $$
declare r jsonb;
begin
  perform test_as('00000000-0000-0000-0000-00000000000b');
  r := claim_mission_chest();
  perform test_admin();
  update daily_counters set checked_in = true, quiz_finished = 1, stations = array['a','b'], coin_pickups = 10,
    distance = 300, run_questions = 2, gifts = 1, thanks_sent = 1
    where user_id = '00000000-0000-0000-0000-00000000000b' and day = _today();
  perform test_as('00000000-0000-0000-0000-00000000000b');
  r := claim_mission_chest();
  assert (r -> 'result' ->> 'xp')::int = 30, 'mở rương nhiệm vụ';
  r := claim_mission_chest();
  assert r -> 'result' = 'null'::jsonb, 'rương chỉ mở 1 lần';
end $$;

\echo '14. Quản trị: phân quyền, câu hỏi, phiếu quà'
do $$
declare r jsonb; v_id bigint;
begin
  perform test_as('00000000-0000-0000-0000-00000000000a');
  perform test_expect_error('select staff_list_questions()', 'forbidden');
  r := claim_first_admin();
  assert (r ->> 'ok')::boolean, 'người đầu tiên thành admin';
  perform test_as('00000000-0000-0000-0000-00000000000b');
  r := claim_first_admin();
  assert not (r ->> 'ok')::boolean, 'không có admin thứ 2 qua cửa này';
  perform test_as('00000000-0000-0000-0000-00000000000a');
  r := staff_list_questions();
  assert (r ->> 'total')::int > 100, 'admin thấy ngân hàng câu hỏi';
  r := staff_save_question(null, 'general', null, 'Câu hỏi thử của admin?', array['Đúng', 'Sai'], null);
  assert r ->> 'status' = 'approved', 'admin thêm câu → duyệt luôn';
  perform admin_update_player('00000000-0000-0000-0000-00000000000b', null, null, 'teacher', null);
  perform test_expect_error($q$select admin_update_player('00000000-0000-0000-0000-00000000000a', null, null, 'player', null)$q$, 'cannot_change_own_role');
  perform test_as('00000000-0000-0000-0000-00000000000b');
  r := staff_save_question(null, 'values', 'nhanAi', 'Câu hỏi giáo viên soạn?', array['A', 'B', 'C'], 'Giải thích');
  v_id := (r ->> 'id')::bigint;
  assert r ->> 'status' = 'pending', 'giáo viên soạn → chờ duyệt';
  perform test_expect_error($q$select staff_review_question(1, 'approved')$q$, 'forbidden');
end $$;
-- (admin_stats cho phép giáo viên xem; kiểm tra lại đúng hành vi:)
do $$
declare r jsonb;
begin
  perform test_as('00000000-0000-0000-0000-00000000000b');
  r := admin_stats();
  assert (r ->> 'players')::int = 3, 'thống kê số người chơi';
  perform test_as('00000000-0000-0000-0000-00000000000a');
  perform staff_review_question((select max(id) from staff_list_questions('pending') x, jsonb_array_elements(x -> 'rows') e, lateral (select (e ->> 'id')::bigint as id) t), 'approved');
  r := admin_grant_voucher('00000000-0000-0000-0000-00000000000b', 'Sổ tay VA', 'Top 1 tuần');
  r := admin_list_vouchers();
  assert jsonb_array_length(r) >= 1, 'danh sách phiếu quà';
  perform admin_decide_voucher((r -> 0 ->> 'id')::bigint, 'redeemed', 'Đã trao');
  perform test_as('00000000-0000-0000-0000-00000000000b');
  r := my_vouchers();
  assert r -> 0 ->> 'status' = 'redeemed', 'người chơi thấy phiếu quà đã trao';
  r := admin_list_players();
  assert (r ->> 'total')::int = 3, 'danh sách người chơi';
end $$;

\echo '15. Giờ Vàng nhân đôi XP'
do $$
declare r jsonb;
begin
  perform test_admin();
  update game_settings set value = jsonb_set(value, '{RANGES}', '[[0, 24]]') where key = 'GOLDEN_HOURS';
  update daily_counters set checked_in = false where user_id = '00000000-0000-0000-0000-00000000000a';
  perform test_as('00000000-0000-0000-0000-00000000000a');
  r := claim_checkin();
  assert (r -> 'result' ->> 'xp')::int = 40 and (r -> 'result' ->> 'golden')::boolean, 'Giờ Vàng x2 XP';
  perform test_admin();
  update game_settings set value = jsonb_set(value, '{RANGES}', '[[12, 13], [19, 21]]') where key = 'GOLDEN_HOURS';
end $$;

\echo '16. Đổi Xu lấy Phiếu quà: trừ Xu, giới hạn, hoàn Xu khi không duyệt'
do $$
declare r jsonb; v_coins int; v_id bigint;
begin
  perform test_admin();
  update player_state set coins = 5000 where user_id = '00000000-0000-0000-0000-00000000000b';
  update gift_catalog set stock = 1 where id = 'gau-bong';
  perform test_as('00000000-0000-0000-0000-00000000000b');
  r := gift_shop();
  assert jsonb_array_length(r -> 'gifts') >= 8, 'có danh mục quà';
  r := redeem_gift('gau-bong');
  v_id := (r ->> 'voucherId')::bigint;
  assert (r -> 'state' ->> 'coins')::int = 1000, 'trừ 4000 Xu';
  perform test_expect_error($q$select redeem_gift('gau-bong')$q$, 'gift_out_of_stock');
  perform redeem_gift('so-tay');
  perform test_expect_error($q$select redeem_gift('but-va')$q$, 'too_many_pending');
  perform test_expect_error($q$select redeem_gift('khong-co')$q$, 'gift_not_found');
  r := my_vouchers();
  assert r -> 0 ->> 'source' = 'shop' and r -> 0 ->> 'status' = 'pending', 'phiếu chờ duyệt';
  -- BGH không duyệt gấu bông → hoàn 4000 Xu + trả lại 1 món.
  perform test_as('00000000-0000-0000-0000-00000000000a');
  perform admin_decide_voucher(v_id, 'rejected', 'Hết hàng');
  perform admin_decide_voucher(v_id, 'rejected', 'Bấm lại'); -- không hoàn 2 lần
  perform test_as('00000000-0000-0000-0000-00000000000b');
  select coins into v_coins from player_state where user_id = '00000000-0000-0000-0000-00000000000b';
  assert v_coins = 200 + 4000, 'hoàn Xu đúng 1 lần (5000 - 4000 - 800 + 4000)';
  assert (select stock from gift_catalog where id = 'gau-bong') = 1, 'trả lại số lượng';
  -- Người chơi thường không sửa được danh mục.
  perform test_expect_error($q$select admin_save_gift('x', 'Quà', '🎁', null, 10, null, true)$q$, 'forbidden');
  perform test_as('00000000-0000-0000-0000-00000000000a');
  r := admin_save_gift(null, 'Huy hiệu cài áo', '📛', 'Huy hiệu Kỳ lân', 300, 50, true, 9);
  assert jsonb_array_length(admin_list_gifts()) >= 9, 'thêm quà mới';
end $$;

\echo '17. Thú cưng: ấp trứng khi điểm danh, nở thú chưa có, dắt đi cùng'
do $$
declare r jsonb; v_pet text; v_all text[];
begin
  perform test_admin();
  update player_state set egg_progress = 0, pets = '{}', active_pet = null where user_id = '00000000-0000-0000-0000-00000000000b';
  update daily_counters set checked_in = false where user_id = '00000000-0000-0000-0000-00000000000b';
  perform test_as('00000000-0000-0000-0000-00000000000b');
  r := claim_checkin() -> 'result' -> 'egg';
  assert (r ->> 'progress')::int = 1 and r -> 'hatched' = 'null'::jsonb, 'trứng ấp được 1 ngày';
  -- Ngày thứ 3 → nở.
  perform test_admin();
  update player_state set egg_progress = 2 where user_id = '00000000-0000-0000-0000-00000000000b';
  update daily_counters set checked_in = false where user_id = '00000000-0000-0000-0000-00000000000b';
  perform test_as('00000000-0000-0000-0000-00000000000b');
  r := claim_checkin();
  v_pet := r -> 'result' -> 'egg' -> 'hatched' ->> 'id';
  assert v_pet is not null, 'trứng nở';
  assert r -> 'state' -> 'pets' ->> 'active' = v_pet, 'tự dắt thú cưng đầu tiên';
  assert (r -> 'state' -> 'pets' ->> 'egg')::int = 0, 'trứng mới bắt đầu lại';
  perform test_expect_error($q$select equip_pet('khong-co')$q$, 'pet_not_owned');
  r := equip_pet(null);
  assert r -> 'state' -> 'pets' ->> 'active' is null, 'cho thú cưng nghỉ';
  perform equip_pet(v_pet);
  assert (public_profiles(array['00000000-0000-0000-0000-00000000000b'::uuid]) -> 0 ->> 'pet') = v_pet, 'người khác thấy thú cưng';
  -- Có đủ thú cưng → trứng nở ra Xu.
  perform test_admin();
  select array_agg(p ->> 'id') into v_all from jsonb_array_elements(_cfg('PET_CATALOG')) p;
  update player_state set pets = v_all, egg_progress = 2 where user_id = '00000000-0000-0000-0000-00000000000b';
  update daily_counters set checked_in = false where user_id = '00000000-0000-0000-0000-00000000000b';
  perform test_as('00000000-0000-0000-0000-00000000000b');
  r := claim_checkin() -> 'result' -> 'egg';
  assert (r ->> 'coins')::int = 40 and r -> 'hatched' = 'null'::jsonb, 'đủ bộ → nở ra 40 Xu';
end $$;

\echo '18. Sự kiện 20/11: bật/tắt, đồ sự kiện, thiệp tri ân, câu hỏi sự kiện'
do $$
declare r jsonb; v_before int; v_after int; v_q questions; i int;
begin
  perform test_admin();
  update player_state set coins = 1000 where user_id in ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b');
  delete from kudos where kind = 'thanks';
  update daily_counters set thanks_sent = 0;
  assert (select count(*) from questions where event = 'tri-an-2011') >= 14, 'có câu hỏi sự kiện';
  -- Người chơi thường không bật được sự kiện.
  perform test_as('00000000-0000-0000-0000-00000000000b');
  perform test_expect_error($q$select admin_set_event('on', 'tri-an-2011')$q$, 'forbidden');
  perform test_as('00000000-0000-0000-0000-00000000000a');
  perform admin_set_event('off');
  perform test_as('00000000-0000-0000-0000-00000000000b');
  assert get_my_state() -> 'event' = 'null'::jsonb, 'tắt sự kiện';
  perform test_expect_error($q$select buy_item('hat-flower')$q$, 'event_item_unavailable');
  perform test_admin();
  for i in 1..40 loop
    v_q := _pick_question('00000000-0000-0000-0000-00000000000b', null);
    assert v_q.event is null, 'không phát câu hỏi sự kiện khi tắt';
  end loop;
  -- Bật sự kiện.
  perform test_as('00000000-0000-0000-0000-00000000000a');
  r := admin_set_event('on', 'tri-an-2011');
  assert r ->> 'active' = 'tri-an-2011', 'bật sự kiện';
  perform test_as('00000000-0000-0000-0000-00000000000b');
  assert get_my_state() ->> 'event' = 'tri-an-2011', 'người chơi thấy sự kiện';
  r := buy_item('hat-flower');
  assert r -> 'state' -> 'owned' ? 'hat-flower', 'mua được đồ sự kiện';
  select coins into v_before from player_state where user_id = '00000000-0000-0000-0000-00000000000a';
  r := send_kudos('00000000-0000-0000-0000-00000000000a', 'thanks', 'Cảm ơn cô!', 'hoa-hong');
  assert r ->> 'card' = 'hoa-hong' and (r -> 'reward' ->> 'coins')::int = 10, 'thiệp tri ân: người gửi +10 Xu';
  select coins into v_after from player_state where user_id = '00000000-0000-0000-0000-00000000000a';
  assert v_after - v_before = 10, 'người nhận thiệp +10 Xu';
  perform test_as('00000000-0000-0000-0000-00000000000a');
  assert my_kudos() -> 0 ->> 'card' = 'hoa-hong', 'người nhận thấy mẫu thiệp';
  -- Mẫu thiệp lạ → gửi như lời cảm ơn thường.
  r := send_kudos('00000000-0000-0000-0000-00000000000b', 'thanks', 'Hi', 'thiep-gia');
  assert r -> 'card' = 'null'::jsonb and (r -> 'reward' ->> 'coins')::int = 5, 'thiệp không hợp lệ không có thưởng thêm';
  perform admin_set_event('auto');
end $$;

\echo '19. Rung Chuông Vàng: tham gia, trả lời, loại người sai, cứu trợ, trao thưởng'
do $$
declare
  r jsonb; v_game bigint; v_cycle int; v_c1 int; v_c2 int;
  v_coins_a int; v_xp_b int;
  A uuid := '00000000-0000-0000-0000-00000000000a';
  B uuid := '00000000-0000-0000-0000-00000000000b';
begin
  perform test_as(A);
  perform admin_set_event('off'); -- tránh phụ thuộc lịch sự kiện
  perform test_as(B);
  perform test_expect_error($q$select admin_bell_create('Trận thử', now() + interval '10 minutes', 3, 10, 50, 100)$q$, 'forbidden');
  perform test_as(A);
  r := admin_bell_create('Rung Chuông Vàng thử', now() + interval '10 minutes', 3, 10, 50, 100, 'Sổ tay VA');
  v_game := (r ->> 'id')::bigint;
  perform bell_join(v_game);
  perform test_as(B);
  r := bell_upcoming();
  assert (r -> 'game' ->> 'id')::bigint = v_game and not (r ->> 'joined')::boolean, 'thấy trận sắp diễn ra';
  perform bell_join(v_game);
  r := bell_state(v_game);
  assert r ->> 'phase' = 'lobby' and (r ->> 'players')::int = 2, 'phòng chờ 2 người';
  assert r -> 'question' is null, 'chưa lộ câu hỏi trong phòng chờ';

  -- Vòng 1 bắt đầu.
  perform test_admin();
  select answer_sec + reveal_sec into v_cycle from bell_games where id = v_game;
  update bell_games set starts_at = now() - interval '6 seconds' where id = v_game;
  select correct_index into v_c1 from bell_rounds where game_id = v_game and round = 1;
  select correct_index into v_c2 from bell_rounds where game_id = v_game and round = 2;
  perform test_as(B);
  r := bell_state(v_game);
  assert r ->> 'phase' = 'answer' and (r ->> 'round')::int = 1 and r -> 'question' ->> 'q' is not null, 'vòng 1 đang nhận đáp án';
  assert r -> 'reveal' is null, 'chưa lộ đáp án';
  perform test_expect_error($q$select bell_join($q$ || v_game || $q$)$q$, 'bell_join_closed');
  perform bell_answer(v_game, 1, (v_c1 + 1) % 4); -- B sai
  r := bell_answer(v_game, 1, v_c1);
  assert not (r ->> 'ok')::boolean, 'chỉ được trả lời 1 lần';
  perform test_as(A);
  perform bell_answer(v_game, 1, v_c1); -- A đúng

  -- Công bố vòng 1 (đã qua thời gian bù trễ).
  perform test_admin();
  update bell_games set starts_at = now() - make_interval(secs => 10 + 2) where id = v_game;
  perform test_as(B);
  r := bell_state(v_game);
  assert r ->> 'phase' = 'reveal' and (r -> 'reveal' ->> 'correctIndex')::int = v_c1, 'công bố đáp án vòng 1';
  assert not (r -> 'reveal' ->> 'myCorrect')::boolean and (r -> 'me' ->> 'outRound')::int = 1, 'B bị loại ở câu 1';
  assert (r ->> 'alive')::int = 1, 'còn 1 người';

  -- Vòng 2: B không trả lời được nữa; A trả lời sai nhưng là người duy nhất → cứu trợ.
  perform test_admin();
  update bell_games set starts_at = now() - make_interval(secs => v_cycle + 1) where id = v_game;
  perform test_as(B);
  perform test_expect_error(format('select bell_answer(%s, 2, 0)', v_game), 'bell_eliminated');
  perform test_as(A);
  perform test_expect_error(format('select bell_answer(%s, 1, 0)', v_game), 'bell_round_closed');
  perform bell_answer(v_game, 2, (v_c2 + 1) % 4);
  perform test_admin();
  update bell_games set starts_at = now() - make_interval(secs => v_cycle + 10 + 2) where id = v_game;
  perform test_as(A);
  r := bell_state(v_game);
  assert (r -> 'me' ->> 'outRound') is null and (r ->> 'alive')::int = 1, 'cứu trợ: không ai đúng thì không ai bị loại';

  -- Kết thúc: trao thưởng.
  perform test_admin();
  select coins into v_coins_a from player_state where user_id = A;
  select xp into v_xp_b from player_state where user_id = B;
  update bell_games set starts_at = now() - make_interval(secs => 3 * v_cycle + 1) where id = v_game;
  perform test_as(A);
  r := bell_state(v_game);
  assert r ->> 'phase' = 'ended' and (r -> 'results' ->> 'survivors')::int = 1, 'kết thúc: 1 người thắng';
  assert (r -> 'results' -> 'winners' -> 0 ->> 'me')::boolean, 'A trong danh sách thắng';
  r := bell_state(v_game); -- gọi lại không trao thưởng 2 lần
  perform test_admin();
  assert (select coins from player_state where user_id = A) = v_coins_a + 100, 'A nhận 100 Xu đúng 1 lần';
  assert (select xp from player_state where user_id = B) > v_xp_b, 'B nhận XP tham gia';
  assert exists (select 1 from vouchers where user_id = A and source = 'bell'), 'A nhận phiếu quà (≤ 3 người thắng)';
  perform test_as(A);
  assert jsonb_array_length(admin_bell_results(v_game)) = 2, 'kết quả cho BGH';
  assert (admin_bell_list() -> 0 ->> 'status') = 'finished', 'danh sách trận';
  perform admin_set_event('auto');
end $$;

-- Mốc quãng đường: qua mốc → thưởng đúng một lần, đồ độc quyền không mua được.
do $$
declare
  B uuid := '00000000-0000-0000-0000-00000000000b';
  r jsonb;
  v_coins int;
begin
  perform test_admin();
  update player_state set distance = 9990, milestones = '{}' where user_id = B;
  update daily_counters set last_distance_at = now() - interval '60 seconds' where user_id = B;
  select coins into v_coins from player_state where user_id = B;
  perform test_as(B);
  r := add_distance(20);
  assert jsonb_array_length(r -> 'milestones') = 3, 'qua 3 mốc 1/5/10 km cùng lúc';
  assert (r -> 'state' -> 'coins')::int = v_coins + 170, 'thưởng 20 + 50 + 100 Xu';
  assert r -> 'state' -> 'owned' ? 'shoes-traveler', 'nhận Giày Lữ Khách ở mốc 10 km';
  assert r -> 'state' -> 'milestones' ? 'km10', 'ghi nhận mốc đã nhận';
  assert (r -> 'milestones' -> 2 -> 'item' ->> 'id') = 'shoes-traveler', 'báo món quà độc quyền';
  r := add_distance(0);
  assert jsonb_array_length(r -> 'milestones') = 0, 'không thưởng mốc 2 lần';
  perform test_expect_error($q$select buy_item('shoes-traveler')$q$, 'item_not_buyable');
  assert (public_profiles(array[B]) -> 0 ->> 'distance')::numeric >= 10000, 'hồ sơ công khai có quãng đường (huy hiệu)';
end $$;

select '✔ Tất cả kiểm thử máy chủ đều đạt' as ket_qua;
