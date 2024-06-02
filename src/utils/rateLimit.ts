import { RateLimit } from 'async-sema';

import { osRateLimitEnv } from './flags';

export const osRateLimit = RateLimit(osRateLimitEnv, { uniformDistribution: true });

export const walletRateLimit = RateLimit(10, { uniformDistribution: true });

