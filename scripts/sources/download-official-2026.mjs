#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const manifestPath = path.join(rootDir, 'docs', 'source-manifest-2026.json');
const outputDir = path.join(rootDir, '.cache', 'official-sources', '2026');
const reportPath = path.join(outputDir, 'download-report.json');

const args = new Set(process.argv.slice(2));
const force = args.has('--force');
const dryRun = args.has('--dry-run');
const onlyArg = process.argv.slice(2).find((arg) => arg.startsWith('--only='));
const onlyIds = onlyArg
  ? new Set(onlyArg.slice('--only='.length).split(',').map((value) => value.trim()).filter(Boolean))
  : null;

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function extensionFor(source, contentType = '') {
  if (source.format === 'pdf' || contentType.includes('application/pdf')) return '.pdf';
  if (source.format === 'json' || contentType.includes('application/json')) return '.json';
  return '.html';
}

function assertAllowedUrl(url, allowedHosts) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:') {
    throw new Error(`HTTPS以外は取得しません: ${url}`);
  }
  if (!allowedHosts.includes(parsed.hostname)) {
    throw new Error(`許可されていないホストです: ${parsed.hostname}`);
  }
}

async function fileExists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function downloadSource(source, allowedHosts) {
  assertAllowedUrl(source.url, allowedHosts);

  const plannedPath = path.join(outputDir, `${source.id}${extensionFor(source)}`);
  if (dryRun) {
    return {
      id: source.id,
      url: source.url,
      status: 'planned',
      path: path.relative(rootDir, plannedPath),
    };
  }

  if (!force && await fileExists(plannedPath)) {
    const existing = await readFile(plannedPath);
    return {
      id: source.id,
      url: source.url,
      status: 'reused',
      path: path.relative(rootDir, plannedPath),
      bytes: existing.byteLength,
      sha256: sha256(existing),
    };
  }

  const response = await fetch(source.url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(60_000),
    headers: {
      'user-agent': 'Course-management-tool source collector/1.0',
      accept: source.format === 'pdf'
        ? 'application/pdf,application/octet-stream;q=0.9,*/*;q=0.8'
        : 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
    },
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type') ?? '';
  const bytes = Buffer.from(await response.arrayBuffer());
  const extension = extensionFor(source, contentType);
  const filePath = path.join(outputDir, `${source.id}${extension}`);

  if (source.format === 'pdf' && !contentType.includes('application/pdf') && !bytes.subarray(0, 5).equals(Buffer.from('%PDF-'))) {
    throw new Error(`PDFとして取得できませんでした。content-type=${contentType || 'unknown'}`);
  }

  await writeFile(filePath, bytes);

  return {
    id: source.id,
    url: source.url,
    finalUrl: response.url,
    status: 'downloaded',
    path: path.relative(rootDir, filePath),
    contentType,
    bytes: bytes.byteLength,
    sha256: sha256(bytes),
  };
}

async function main() {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const allowedHosts = manifest.policy?.allowedHosts ?? [];
  const candidates = manifest.sources.filter((source) => {
    if (!source.download) return false;
    return !onlyIds || onlyIds.has(source.id);
  });

  if (onlyIds) {
    const knownIds = new Set(manifest.sources.map((source) => source.id));
    const missing = [...onlyIds].filter((id) => !knownIds.has(id));
    if (missing.length > 0) {
      throw new Error(`manifestに存在しないsource id: ${missing.join(', ')}`);
    }
  }

  await mkdir(outputDir, { recursive: true });

  const results = [];
  for (const source of candidates) {
    process.stdout.write(`[source] ${source.id} ... `);
    try {
      const result = await downloadSource(source, allowedHosts);
      results.push(result);
      console.log(result.status);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({
        id: source.id,
        url: source.url,
        status: 'failed',
        error: message,
      });
      console.log(`failed: ${message}`);
    }
  }

  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    manifestCheckedAt: manifest.checkedAt,
    force,
    dryRun,
    results,
  };

  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  const failed = results.filter((result) => result.status === 'failed');
  console.log(`\nreport: ${path.relative(rootDir, reportPath)}`);
  console.log(`success: ${results.length - failed.length}, failed: ${failed.length}`);

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
