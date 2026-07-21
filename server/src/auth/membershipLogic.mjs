/**
 * 可注入配置的成员校验（供单测覆盖 enforce + 空配置拒绝）
 */
export function evaluateMembershipWithConfig(cfg, member) {
  cfg = cfg || {};
  if (!cfg.authEnforceDiscordMembership) {
    return { ok: true, reason: 'enforce_off' };
  }
  var guildId = cfg.discord && cfg.discord.guildId;
  var rolesNeed = (cfg.discord && cfg.discord.requiredRoleIds) || [];
  if (!guildId || !rolesNeed.length) {
    return {
      ok: false,
      reason: 'membership_config_empty',
      message: '正式注册已启用校验，但 DISCORD_GUILD_ID / DISCORD_REQUIRED_ROLE_IDS 未配置，拒绝所有 Discord 注册。',
    };
  }
  if (!member) {
    return { ok: false, reason: 'not_in_guild', message: '须加入指定 Discord 服务器后才能注册。' };
  }
  var roles = Array.isArray(member.roles) ? member.roles.map(String) : [];
  var hit = rolesNeed.some(function(r) { return roles.indexOf(String(r)) >= 0; });
  if (!hit) {
    return { ok: false, reason: 'missing_role', message: '须拥有指定身份组后才能注册。' };
  }
  return { ok: true, reason: 'ok' };
}

export function canAcceptDiscordRegistrationWithConfig(cfg) {
  if (!cfg.authEnforceDiscordMembership) return true;
  var guildId = cfg.discord && cfg.discord.guildId;
  var rolesNeed = (cfg.discord && cfg.discord.requiredRoleIds) || [];
  return !!(guildId && rolesNeed.length);
}
