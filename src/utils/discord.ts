import axios from 'axios';

import { discordHookEnv } from './flags';
import { logError } from './log';

export const sendMessage = async (message: string): Promise<void> => {
  if (!discordHookEnv) return;
  try {
    await axios.post(discordHookEnv, {
      content: message,
    });
  } catch (err) {
    logError(`Discord notification filed to send. ${err instanceof Error && err.message}`);
  }
};

export const sendFormattedMessage = async (
  topic: string,
  message: string,
  mention = true,
): Promise<void> => {
  await sendMessage(`${mention ? '@here ' : ''}[${topic}]: ${message}`);
};
