if (!process.env.WS_SERVER) {
  throw new Error('WS_SERVER env is required');
}

if (!process.env.INFURA_KEY) {
  throw new Error('INFURA_KEY env is required');
}

if (!process.env.X_NFT_API_KEY) {
  throw new Error('X_NFT_API_KEY env is required');
}

if (!process.env.TMP_DIR) {
  throw new Error('TMP_DIR env is required');
}

if (!process.env.CONFIG_DIR) {
  throw new Error('CONFIG_DIR env is required');
}

export const dryRunEnv = process.env.DRY_RUN === '1';
export const useMaxQuantityEnv = process.env.USE_MAX_QUANTITY === '1';
export const bidToPool1Env = process.env.BID_TO_POOL_1 === '1';
export const noWsEnv = process.env.NO_WS === '1';
export const poolSizeLimitBidEnv = Number(process.env.POOL_SIZE_LIMIT_BID) || 500;
export const poolSizeLimitCancelEnv = Number(process.env.POOL_SIZE_LIMIT_CANCEL) || 450;
export const samePoolSizeLimitBidEnv = Number(process.env.SAME_POOL_SIZE_LIMIT_BID) || 500;
export const samePoolSizeLimitCancelEnv = Number(process.env.SAME_POOL_SIZE_LIMIT_CANCEL) || 450;
export const bidToSamePoolEnv = process.env.BID_TO_SAME_POOL === '1';
export const infuraKeyEnv = process.env.INFURA_KEY;
export const NftApiKeyEnv = process.env.X_NFT_API_KEY;
export const wsServerEnv = process.env.WS_SERVER;
export const wsApiKeyEnv = process.env.X_NFT_API_KEY;
export const tmpDirEnv = process.env.TMP_DIR;
export const configDirEnv = process.env.CONFIG_DIR;
export const discordHookEnv = process.env.DISCORD_HOOK || false;
export const logLevelEnv = Number(process.env.LOG_LEVEL) || 1;
export const discordLogLevelEnv = Number(process.env.DISCORD_LOG_LEVEL) || 1;
export const privateKeysEnv = process.env.PRIVATE_KEYS || '';
export const collectionsEnv = process.env.COLLECTIONS || '';
export const maxPoolToBidEnv = Number(process.env.MAX_POOL_TO_BID) || 3;
export const maxQuantityEnv = Number(process.env.MAX_QUANTITY) || 0;
export const bidExpirationEnv = Number(process.env.BID_EXPIRATION) || 30;
export const osRateLimitEnv = Number(process.env.BLUR_RATE_LIMIT) || 3;

export const floorCheckEnv = process.env.FLOOR_CHECK === '1';
export const floorLimitEnv = Number(process.env.FLOOR_LIMIT);

if (floorCheckEnv && isNaN(floorLimitEnv)) {
  throw new Error('FLOOR_LIMIT env is not a valid number');
}

if (osRateLimitEnv <= 0) {
  throw new Error('BLUR_RATE_LIMIT env has to be greater than 0');
}

if (bidToPool1Env) {
  // If bidToPool1Env is true (1), then the range is 1-5
  if (maxPoolToBidEnv < 1 || maxPoolToBidEnv > 5) {
    throw new Error('MAX_POOL_TO_BID env must be in the range 1-5 when BID_TO_POOL_1 is enabled');
  }
} else {
  // If bidToPool1Env is false (0), then the range is 2-5
  if (maxPoolToBidEnv < 2 || maxPoolToBidEnv > 5) {
    throw new Error('MAX_POOL_TO_BID env must be in the range 2-5 when BID_TO_POOL_1 is disabled');
  }
}

if (poolSizeLimitCancelEnv > poolSizeLimitBidEnv) {
  throw new Error('POOL_SIZE_LIMIT_CANCEL env has to be lower or equal to POOL_SIZE_LIMIT_BID env');
}

if (samePoolSizeLimitCancelEnv > samePoolSizeLimitBidEnv) {
  throw new Error(
    'SAME_POOL_SIZE_LIMIT_CANCEL env has to be lower or equal to SAME_POOL_SIZE_LIMIT_BID env',
  );
}

if (bidExpirationEnv < 15) {
  throw new Error('BID_EXPIRATION env has to be greater or equal to 15');
}
