/**
 * Bộ xử lý TRỰC TUYẾN: gọi các hàm RPC trên Supabase (supabase/sql/*.sql).
 * Máy chủ quyết định mọi điểm thưởng → không ai sửa điểm được từ trình duyệt.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @returns {object} cùng giao diện với createLocalBackend()
 */
export function createRemoteBackend(supabase) {
  async function rpc(fn, args = {}) {
    const { data, error } = await supabase.rpc(fn, args);
    if (error) {
      const err = new Error(error.message || 'server_error');
      err.code = error.code;
      throw err;
    }
    return data;
  }

  return {
    mode: 'remote',
    getState: () => rpc('get_my_state'),
    updateProfile: (displayName, unit) => rpc('update_profile', { p_display_name: displayName, p_unit: unit }),
    claimCheckin: () => rpc('claim_checkin'),
    startQuizRound: () => rpc('start_quiz_round'),
    issueQuestion: (kind, station = null) => rpc('issue_question', { p_kind: kind, p_station: station }),
    answerTicket: (ticketId, choice) => rpc('answer_ticket', { p_ticket: ticketId, p_choice: choice }),
    finishQuizRound: (roundId) => rpc('finish_quiz_round', { p_round: roundId }),
    addDistance: (meters) => rpc('add_distance', { p_meters: meters }),
    collectCoin: () => rpc('collect_coin'),
    openGift: () => rpc('open_gift'),
    buyItem: (itemId) => rpc('buy_item', { p_item: itemId }),
    equipItem: (itemId) => rpc('equip_item', { p_item: itemId }),
    claimMissionChest: () => rpc('claim_mission_chest'),
    sendKudos: (to, kind, message = null) => rpc('send_kudos', { p_to: to, p_kind: kind, p_message: message }),
    publicProfiles: (ids) => rpc('public_profiles', { p_ids: ids }),
    publicProfile: (id) => rpc('public_profile', { p_id: id }),
    myKudos: () => rpc('my_kudos'),
    myVouchers: () => rpc('my_vouchers'),
    leaderboard: (scope, unit = null) => rpc('leaderboard', { p_scope: scope, p_unit: unit }),
    houseStandings: () => rpc('house_standings'),
  };
}
