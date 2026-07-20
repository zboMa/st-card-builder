/**
 * Discord 成员/身份组校验
 * enforce=true 且 Guild/Role 留空 → 拒绝所有正式注册
 */
import { config } from '../config.mjs';
import {
  evaluateMembershipWithConfig,
  canAcceptDiscordRegistrationWithConfig,
} from './membershipLogic.mjs';

export function evaluateDiscordMembership(member) {
  return evaluateMembershipWithConfig(config, member);
}

export function canAcceptDiscordRegistration() {
  return canAcceptDiscordRegistrationWithConfig(config);
}
