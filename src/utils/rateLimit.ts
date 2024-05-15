import { RateLimit } from 'async-sema';

import { osRateLimitEnv } from './flags';

export const osRateLimit = RateLimit(osRateLimitEnv, { uniformDistribution: true });

