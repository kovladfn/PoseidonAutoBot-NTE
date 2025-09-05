import axios from 'axios';
import cfonts from 'cfonts';
import gradient from 'gradient-string';
import chalk from 'chalk';
import fs from 'fs/promises';
import readline from 'readline';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';
import ProgressBar from 'progress';
import ora from 'ora';
import crypto from 'crypto';
import gtts from 'node-gtts';
import { Console } from 'console';

const logger = {
  info: (msg, options = {}) => {
    const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const emoji = options.emoji || 'ℹ️  ';
    const context = options.context ? `[${options.context}] ` : '';
    const level = chalk.green('INFO');
    const formattedMsg = `[ ${chalk.gray(timestamp)} ] ${emoji}${level} ${chalk.white(context.padEnd(20))}${chalk.white(msg)}`;
    console.log(formattedMsg);
  },
  warn: (msg, options = {}) => {
    const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const emoji = options.emoji || '⚠️  ';
    const context = options.context ? `[${options.context}] ` : '';
    const level = chalk.yellow('WARN');
    const formattedMsg = `[ ${chalk.gray(timestamp)} ] ${emoji}${level} ${chalk.white(context.padEnd(20))}${chalk.white(msg)}`;
    console.log(formattedMsg);
  },
  error: (msg, options = {}) => {
    const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const emoji = options.emoji || '❌  ';
    const context = options.context ? `[${options.context}] ` : '';
    const level = chalk.red('ERROR');
    const formattedMsg = `[ ${chalk.gray(timestamp)} ] ${emoji}${level} ${chalk.white(context.padEnd(20))}${chalk.white(msg)}`;
    console.log(formattedMsg);
  }
};

function delay(seconds) {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

async function countdownDelay() {
  const minSeconds = 240; 
  const maxSeconds = 450; 
  const waitTime = Math.floor(Math.random() * (maxSeconds - minSeconds + 1)) + minSeconds;
  let remaining = waitTime;

  const updateCountdown = () => {
    const min = Math.floor(remaining / 60);
    const sec = remaining % 60;
    process.stdout.write(`\rCooldown before next campaign: ${min}:${sec.toString().padStart(2, '0')}`);
  };

  updateCountdown();

  const interval = setInterval(() => {
    remaining--;
    if (remaining > 0) {
      updateCountdown();
    } else {
      clearInterval(interval);
      process.stdout.write('\r' + ' '.repeat(process.stdout.columns || 80) + '\r');
      console.log(); 
    }
  }, 1000);

  await delay(waitTime);
}

function stripAnsi(str) {
  return str.replace(/\x1B\[[0-9;]*m/g, '');
}

function centerText(text, width) {
  const cleanText = stripAnsi(text);
  const textLength = cleanText.length;
  const totalPadding = Math.max(0, width - textLength);
  const leftPadding = Math.floor(totalPadding / 2);
  const rightPadding = totalPadding - leftPadding;
  return `${' '.repeat(leftPadding)}${text}${' '.repeat(rightPadding)}`;
}

function printHeader(title) {
  const width = 80;
  console.log(gradient.morning(`┬${'─'.repeat(width - 2)}┬`));
  console.log(gradient.morning(`│ ${title.padEnd(width - 4)} │`));
  console.log(gradient.morning(`┴${'─'.repeat(width - 2)}┴`));
}

function printInfo(label, value, context) {
  logger.info(`${label.padEnd(15)}: ${chalk.cyan(value)}`, { emoji: '📍 ', context });
}

async function formatCampaignTable(campaigns, context) {
  console.log('\n');
  logger.info('Campaign List:', { context, emoji: '📋 ' });
  console.log('\n');

  const spinner = ora('Rendering campaigns...').start();
  await new Promise(resolve => setTimeout(resolve, 1000));
  spinner.stop();

  const header = chalk.cyanBright('+----------------------+----------+-------+----------+\n| Campaign Name        | Language | Tags  |  Status  |\n+-----------------------+----------+-------+---------+');
  const rows = campaigns.map(campaign => {
    const displayName = campaign.campaign_name && typeof campaign.campaign_name === 'string'
      ? (campaign.campaign_name.length > 20 ? campaign.campaign_name.slice(0, 17) + '...' : campaign.campaign_name)
      : 'Unknown Campaign';
    const language = (campaign.supported_languages[0] || 'N/A').padEnd(8);
    const tags = (campaign.tags.join(', ') || 'N/A').slice(0, 7);
    const status = campaign.registration_status === 'CONFIRMED' ? chalk.greenBright('Active') : chalk.yellowBright('Pending');
    return `| ${displayName.padEnd(20)} | ${language} | ${tags.padEnd(5)} | ${status.padEnd(6)} |`;
  }).join('\n');
  const footer = chalk.cyanBright('+----------------------+----------+-------+----------+');

  console.log(header + '\n' + rows + '\n' + footer);
  console.log('\n');
}

async function formatUploadTable(uploads, context) {
  console.log('\n');
  logger.info('Upload List:', { context, emoji: '🗳️  ' });
  console.log('\n');

  const spinner = ora('Rendering uploads...').start();
  await new Promise(resolve => setTimeout(resolve, 1000));
  spinner.stop();

  const header = chalk.cyanBright('+----------------------+-----------------+\n| Campaign Title       | Upload Status   |\n+----------------------+-----------------+');
  const rows = uploads.map(upload => {
    const displayTitle = upload.title && typeof upload.title === 'string'
      ? (upload.title.length > 20 ? upload.title.slice(0, 17) + '...' : upload.title)
      : 'Unknown';
    const status = upload.status ? chalk.greenBright(upload.status) : chalk.redBright('Failed');
    return `| ${displayTitle.padEnd(20)} | ${status.padEnd(15)}       |`;
  }).join('\n');
  const footer = chalk.cyanBright('+----------------------+-----------------+');

  console.log(header + '\n' + rows + '\n' + footer);
  console.log('\n');
}

const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/105.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Firefox/102.0'
];

function getRandomUserAgent() {
  return userAgents[Math.floor(Math.random() * userAgents.length)];
}

function getGlobalHeaders(token = null) {
  const headers = {
    'accept': 'application/json, text/plain, */*',
    'accept-encoding': 'gzip, deflate, br, zstd',
    'accept-language': 'en-US,en;q=0.9,id;q=0.8',
    'origin': 'https://app.psdn.ai',
    'priority': 'u=1, i',
    'referer': 'https://app.psdn.ai/',
    'sec-ch-ua': '"Chromium";v="134", "Not:A-Brand";v="24", "Google Chrome";v="134"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'cross-site',
    'user-agent': getRandomUserAgent()
  };
  if (token) {
    headers['authorization'] = `Bearer ${token}`;
  }
  return headers;
}

function getAxiosConfig(proxy, token = null) {
  const config = {
    headers: getGlobalHeaders(token),
    timeout: 60000
  };
  if (proxy) {
    config.httpsAgent = newAgent(proxy);
    config.proxy = false;
  }
  return config;
}

function newAgent(proxy) {
  if (proxy.startsWith('http://') || proxy.startsWith('https://')) {
    return new HttpsProxyAgent(proxy);
  } else if (proxy.startsWith('socks4://') || proxy.startsWith('socks5://')) {
    return new SocksProxyAgent(proxy);
  } else {
    logger.warn(`Unsupported proxy: ${proxy}`);
    return null;
  }
}

async function requestWithRetry(method, url, payload = null, config = {}, retries = 5, backoff = 5000, context) {
  for (let i = 0; i < retries; i++) {
    try {
      let response;
      if (method.toLowerCase() === 'get') {
        response = await axios.get(url, config);
      } else if (method.toLowerCase() === 'post') {
        response = await axios.post(url, payload, config);
      } else if (method.toLowerCase() === 'put') {
        response = await axios.put(url, payload, config);
      } else {
        throw new Error(`Method ${method} not supported`);
      }
      return { success: true, response: response.data };
    } catch (error) {
      let status = error.response?.status;
      if (status === 429) {
        backoff = 30000;
      }
      if (status === 400 || status === 404) {
        return { success: false, message: error.response?.data?.message || 'Bad request', status };
      }
      if (i < retries - 1) {
        await delay(backoff / 1000);
        backoff *= 1.5;
        continue;
      }
      logger.error(`Request failed after ${retries} attempts: ${error.message} - Status: ${status}`, { context });
      return { success: false, message: error.message, status };
    }
  }
}

const BASE_URL = 'https://poseidon-depin-server.storyapis.com';

async function readTokens() {
  try {
    const data = await fs.readFile('token.txt', 'utf-8');
    const tokens = data.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    logger.info(`Loaded ${tokens.length} token${tokens.length === 1 ? '' : 's'}`, { emoji: '📄 ' });
    return tokens;
  } catch (error) {
    logger.error(`Failed to read token.txt: ${error.message}`, { emoji: '❌ ' });
    return [];
  }
}

async function readProxies() {
  try {
    const data = await fs.readFile('proxy.txt', 'utf-8');
    const proxies = data.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    if (proxies.length === 0) {
      logger.warn('No proxies found. Proceeding without proxy.', { emoji: '⚠️  ' });
    } else {
      logger.info(`Loaded ${proxies.length} prox${proxies.length === 1 ? 'y' : 'ies'}`, { emoji: '🌐  ' });
    }
    return proxies;
  } catch (error) {
    logger.warn('proxy.txt not found.', { emoji: '⚠️ ' });
    return [];
  }
}

async function getPublicIP(proxy, context) {
  try {
    const config = getAxiosConfig(proxy);
    delete config.headers.authorization;
    const response = await requestWithRetry('get', 'https://api.ipify.org?format=json', null, config, 5, 5000, context);
    return response.response.ip || 'Unknown';
  } catch (error) {
    logger.error(`Failed to get IP: ${error.message}`, { emoji: '❌  ', context });
    return 'Error retrieving IP';
  }
}

async function fetchQuota(token, campaignId, proxy, context) {
  try {
    const res = await requestWithRetry('get', `${BASE_URL}/campaigns/${campaignId}/access`, null, getAxiosConfig(proxy, token), 5, 5000, context);
    if (!res.success) {
      throw new Error(res.message);
    }
    return res.response;
  } catch (error) {
    logger.error(`Failed to fetch quota: ${error.message}`, { context });
    return { remaining: 0, cap: 0 };
  }
}

async function fetchCampaigns(token, proxy, context) {
  try {
    const res = await requestWithRetry('get', `${BASE_URL}/campaigns?page=1&size=100`, null, getAxiosConfig(proxy, token), 5, 5000, context);
    if (!res.success) {
      throw new Error(res.message);
    }
    return res.response.items.filter(campaign => campaign.campaign_type === 'AUDIO' && campaign.is_scripted);
  } catch (error) {
    logger.error(`Failed to fetch campaigns: ${error.message}`, { context });
    return [];
  }
}

async function fetchNextScript(token, languageCode, campaignId, proxy, context) {
  try {
    const res = await requestWithRetry('get', `${BASE_URL}/scripts/next?language_code=${languageCode}&campaign_id=${campaignId}`, null, getAxiosConfig(proxy, token), 5, 5000, context);
    if (!res.success) {
      throw new Error(res.message);
    }
    return res.response;
  } catch (error) {
    logger.error(`Failed to fetch next script: ${error.message}`, { context });
    return null;
  }
}

async function generateAudioBuffer(text, lang) {
  const originalConsoleLog = console.log;
  console.log = () => {}; 
  if (lang === 'mr' || lang === 'ur') {
    lang = 'hi';
  }
  const speaker = gtts(lang);
  const stream = speaker.stream(text);
  try {
    const buffer = await Promise.race([
      new Promise((_, reject) => setTimeout(() => reject(new Error('Audio generation timeout after 30 seconds')), 30000)),
      new Promise((resolve, reject) => {
        const chunks = [];
        stream.on('data', chunk => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', reject);
      })
    ]);
    console.log = originalConsoleLog;  
    return buffer;
  } catch (err) {
    console.log = originalConsoleLog; 
    throw err;
  }
}

async function getUploadPresigned(token, campaignId, fileName, assignmentId, proxy, context) {
  const payload = {
    content_type: 'audio/webm',
    file_name: fileName,
    script_assignment_id: assignmentId
  };
  try {
    const res = await requestWithRetry('post', `${BASE_URL}/files/uploads/${campaignId}`, payload, getAxiosConfig(proxy, token), 5, 5000, context);
    if (!res.success) {
      throw new Error(res.message);
    }
    return res.response;
  } catch (error) {
    logger.error(`Failed to get presigned URL: ${error.message}`, { context });
    return null;
  }
}

async function uploadToPresigned(url, audioBuffer, context) {
  const config = {
    headers: {
      'content-type': 'audio/webm',
      'content-length': audioBuffer.length
    }
  };
  try {
    const res = await requestWithRetry('put', url, audioBuffer, config, 5, 5000, context);
    if (!res.success) {
      throw new Error(res.message);
    }
    return { success: true };
  } catch (error) {
    logger.error(`Failed to upload to presigned URL: ${error.message}`, { context });
    return { success: false };
  }
}

async function confirmUpload(token, payload, proxy, context) {
  try {
    const res = await requestWithRetry('post', `${BASE_URL}/files`, payload, getAxiosConfig(proxy, token), 5, 5000, context);
    if (!res.success) {
      throw new Error(res.message);
    }
    return res.response;
  } catch (error) {
    logger.error(`Failed to confirm upload: ${error.message}`, { context });
    return null;
  }
}

async function fetchUserInfo(token, proxy, context) {
  try {
    const res = await requestWithRetry('get', `${BASE_URL}/users/me`, null, getAxiosConfig(proxy, token), 5, 5000, context);
    if (!res.success) {
      throw new Error(res.message);
    }
    return {
      username: res.response.name,
      points: res.response.points,
      address: res.response.dynamic_wallet || 'N/A'
    };
  } catch (error) {
    logger.error(`Failed to fetch user info: ${error.message}`, { context });
    return { username: 'Unknown', points: 'N/A', address: 'N/A' };
  }
}

async function processToken(token, index, total, proxy = null) {
  const context = `Account ${index + 1}/${total}`;
  logger.info(chalk.bold.magentaBright(`Starting account processing`), { emoji: '🚀 ', context });

  printHeader(`Account Info ${context}`);
  const ip = await getPublicIP(proxy, context);
  const userInfo = await fetchUserInfo(token, proxy, context);
  printInfo('IP', ip, context);
  printInfo('Username', userInfo.username, context);
  console.log('\n');

  console.log('\n');
  logger.info('Starting campaigns process...', { context });
  console.log('\n');
  const campaigns = await fetchCampaigns(token, proxy, context);
  if (campaigns.length === 0) {
    logger.info('No campaigns available', { emoji: '⚠️ ', context });
    return;
  }
  await formatCampaignTable(campaigns, context);

  console.log('\n');
  logger.info('Starting voice upload process...', { context });
  console.log('\n');

  const uploads = [];
  for (let campIndex = 0; campIndex < campaigns.length; campIndex++) {
    const campaign = campaigns[campIndex];
    const campaignContext = `${context}|${campaign.campaign_name.slice(0, 10)}`;
    let quota = await fetchQuota(token, campaign.virtual_id, proxy, campaignContext);
    logger.info(chalk.bold.yellowBright(`Quota for ${campaign.campaign_name}: ${quota.remaining} remaining out of ${quota.cap}`), { emoji: 'ℹ️  ', context: campaignContext });

    if (quota.remaining > 0) {
      const bar = new ProgressBar('Uploading [:bar] :percent :etas', {
        complete: '█',
        incomplete: '░',
        width: 30,
        total: quota.remaining
      });

      let currentRemaining = quota.remaining;
      let i = 0;
      console.log('\n');
      while (currentRemaining > 0 && i < quota.cap) { 
        const spinner = ora({ text: `Processing upload ${i + 1} for ${campaign.campaign_name}...`, spinner: 'dots' }).start();

        const lang = campaign.supported_languages[0];
        const nextScript = await fetchNextScript(token, lang, campaign.virtual_id, proxy, campaignContext);
        if (!nextScript) {
          spinner.fail(chalk.bold.redBright(`Failed to get script`));
          bar.tick(); 
          i++;
          continue;
        }

        const text = nextScript.script.content;
        let audioBuffer;
        try {
          audioBuffer = await generateAudioBuffer(text, lang);
        } catch (err) {
          spinner.fail(chalk.bold.redBright(`Failed to generate audio: ${err.message}`));
          bar.tick();
          i++;
          continue;
        }
        const timestamp = Date.now();
        const fileName = `audio_recording_${timestamp}.webm`;
        const assignmentId = nextScript.assignment_id;

        const presigned = await getUploadPresigned(token, campaign.virtual_id, fileName, assignmentId, proxy, campaignContext);
        if (!presigned) {
          spinner.fail(chalk.bold.redBright(`  Failed to get presigned URL`));
          bar.tick();
          i++;
          continue;
        }

        const uploadRes = await uploadToPresigned(presigned.presigned_url, audioBuffer, campaignContext);
        if (!uploadRes.success) {
          spinner.fail(chalk.bold.redBright(`  Failed to upload audio`));
          bar.tick();
          i++;
          continue;
        }

        const hash = crypto.createHash('sha256').update(audioBuffer).digest('hex');
        const confirmPayload = {
          content_type: 'audio/webm',
          object_key: presigned.object_key,
          sha256_hash: hash,
          filesize: audioBuffer.length,
          file_name: fileName,
          virtual_id: presigned.file_id,
          campaign_id: campaign.virtual_id
        };

        const confirmRes = await confirmUpload(token, confirmPayload, proxy, campaignContext);
        if (!confirmRes) {
          spinner.fail(chalk.bold.redBright(`  Failed to confirm upload`));
          uploads.push({ title: campaign.campaign_name, status: 'Failed' });
          bar.tick();
        } else {
          spinner.succeed(chalk.bold.greenBright(`  Uploaded successfully`));
          uploads.push({ title: campaign.campaign_name, status: 'Success' });
          bar.tick();
        }

        quota = await fetchQuota(token, campaign.virtual_id, proxy, campaignContext);
        currentRemaining = quota.remaining;

        i++;
        if (currentRemaining > 0) {
          await delay(15);
        }
      }

      if (campIndex < campaigns.length - 1) {
        await countdownDelay();
      }
    } else {
      logger.info(chalk.bold.yellowBright(`No remaining quota for ${campaign.campaign_name}, skipping.`), { emoji: '⚠️  ', context: campaignContext });
    }
    console.log('\n');
  }

  if (uploads.length > 0) {
    await formatUploadTable(uploads, context);
  } else {
    logger.info(chalk.bold.yellowBright('No uploads performed.'), { context });
  }

  printHeader(`Account Stats ${context}`);
  const finalUserInfo = await fetchUserInfo(token, proxy, context);
  printInfo('Username', finalUserInfo.username, context);
  printInfo('Address', finalUserInfo.address, context);
  printInfo('Points', finalUserInfo.points, context);

  logger.info(chalk.bold.greenBright(`Completed account processing`), { emoji: '🎉 ', context });
}

async function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans);
  }));
}

let globalUseProxy = false;
let globalProxies = [];

async function initializeConfig() {
  const useProxyAns = await askQuestion(chalk.cyanBright('🔌 Do You Want Use Proxy? (y/n): '));
  if (useProxyAns.trim().toLowerCase() === 'y') {
    globalUseProxy = true;
    globalProxies = await readProxies();
    if (globalProxies.length === 0) {
      globalUseProxy = false;
      logger.warn('No proxies available, proceeding without proxy.', { emoji: '⚠️ ' });
    }
  } else {
    logger.info('Proceeding without proxy.', { emoji: 'ℹ️ ' });
  }
}

async function runCycle() {
  const tokens = await readTokens();
  if (tokens.length === 0) {
    logger.error('No tokens found in token.txt. Exiting cycle.', { emoji: '❌ ' });
    return;
  }

  for (let i = 0; i < tokens.length; i++) {
    const proxy = globalUseProxy ? globalProxies[i % globalProxies.length] : null;
    try {
      await processToken(tokens[i], i, tokens.length, proxy);
    } catch (error) {
      logger.error(`Error processing account: ${error.message}`, { emoji: '❌ ', context: `Account ${i + 1}/${tokens.length}` });
    }
    if (i < tokens.length - 1) {
      console.log('\n\n');
    }
    await delay(5);
  }
}

async function run() {
  const terminalWidth = process.stdout.columns || 80;
  cfonts.say('NT EXHAUST', {
    font: 'block',
    align: 'center',
    colors: ['cyan', 'magenta'],
    background: 'transparent',
    letterSpacing: 1,
    lineHeight: 1,
    space: true
  });
  console.log(gradient.retro(centerText('=== Telegram Channel 🚀 : NT EXHAUST @NTExhaust ===', terminalWidth)));
  console.log(gradient.retro(centerText('✪ POSEIDON BOT AUTO UPLOAD VOICE ✪', terminalWidth)));
  console.log('\n');
  await initializeConfig();

  while (true) {
    await runCycle();
    logger.info(chalk.bold.yellowBright('Cycle completed. Waiting 24 hours...'), { emoji: '🔄 ' });
    await delay(86400);
  }
}

run().catch(error => logger.error(`Fatal error: ${error.message}`, { emoji: '❌' }));