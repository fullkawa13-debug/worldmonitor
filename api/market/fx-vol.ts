export const config = { runtime: 'edge' };

import { getCachedJson } from '../../server/_shared/redis';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET',
  'Content-Type': 'application/json',
};

export default async function handler(_req: Request): Promise<Response> {
  try {
    const data = await getCachedJson('market:fx-vol:v1', true);
    if (!data) {
      return new Response(JSON.stringify({ unavailable: true, pairs: [] }), { status: 200, headers: CORS });
    }
    return new Response(JSON.stringify(data), { status: 200, headers: CORS });
  } catch {
    return new Response(JSON.stringify({ unavailable: true, pairs: [] }), { status: 200, headers: CORS });
  }
}
