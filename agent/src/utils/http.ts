import axios from 'axios';
import dns from 'node:dns';
import nodeHttp from 'http';
import https from 'https';
import { config } from '../config';

const dnsResultOrder = (
  process.env.AGENT_DNS_RESULT_ORDER ||
  process.env.NODE_DNS_RESULT_ORDER ||
  'ipv4first'
).toLowerCase();

if (
  dnsResultOrder === 'ipv4first' ||
  dnsResultOrder === 'ipv6first' ||
  dnsResultOrder === 'verbatim'
) {
  dns.setDefaultResultOrder(
    dnsResultOrder as 'ipv4first' | 'ipv6first' | 'verbatim',
  );
}

const lookupFamilyValue = parseInt(process.env.AGENT_HTTP_IP_FAMILY || '0', 10);
const lookupFamily = lookupFamilyValue === 4 || lookupFamilyValue === 6
  ? lookupFamilyValue
  : undefined;

const lookup = lookupFamily
  ? ((hostname: string, options: any, callback: any) => {
      const normalizedOptions =
        typeof options === 'object' && options !== null ? options : {};
      dns.lookup(
        hostname,
        {
          ...normalizedOptions,
          family: lookupFamily,
          all: false,
        },
        callback,
      );
    })
  : undefined;

// Centralized HTTP client for the agent.
// If AGENT_TLS_INSECURE=true|1, disable TLS verification to tolerate
// misconfigured/intermediate-missing cert chains on the master server.
const httpAgent = lookup ? new nodeHttp.Agent({ lookup }) : undefined;
const httpsAgent =
  lookup || config.tlsInsecure
    ? new https.Agent({
        ...(lookup ? { lookup } : {}),
        ...(config.tlsInsecure ? { rejectUnauthorized: false } : {}),
      })
    : undefined;

export const http = axios.create({
  httpAgent,
  httpsAgent,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default http;
