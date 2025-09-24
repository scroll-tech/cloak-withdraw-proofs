import { Request, Response } from 'express';

import {
  JSONRPCServer,
  JSONRPCErrorException,
  JSONRPCErrorCode,
  createJSONRPCErrorResponse,
} from 'json-rpc-2.0';

import * as withdrawals from './db/withdrawals';

import baseLogger from './logger';
const logger = baseLogger.child({ module: 'rpc' });

function validateHash(hash: string) {
  if (typeof hash !== 'string' || !hash.startsWith('0x') || hash.length !== 66) {
    throw new JSONRPCErrorException('Invalid hash', JSONRPCErrorCode.ParseError, null);
  }
}

const server = new JSONRPCServer();

server.addMethod('scroll_withdrawalsByTransaction', async ([txHash]: [string]) => {
  validateHash(txHash);
  const ws = await withdrawals.findByTxHash(txHash);
  return ws;
});

server.addMethod('scroll_withdrawalByMessageHash', async ([messageHash]: [string]) => {
  validateHash(messageHash);
  const ws = await withdrawals.findByMessageHash(messageHash);
  return ws.length === 0 ? null : ws[0];
});

server.applyMiddleware((next, request, serverParams) => {
  logger.debug(`Received ${JSON.stringify(request)}`);
  return next(request, serverParams);
});

server.applyMiddleware(async (next, request, serverParams) => {
  try {
    return await next(request, serverParams);
  } catch (error: unknown) {
    if (error instanceof JSONRPCErrorException && request.id !== undefined) {
      return createJSONRPCErrorResponse(request.id!, error.code, error.message);
    } else {
      throw error;
    }
  }
});

async function handler(req: Request, res: Response) {
  const rpcResponse = await server.receive(req.body);
  if (rpcResponse) {
    res.json(rpcResponse);
  } else {
    res.sendStatus(204);
  }
}

export default handler;
