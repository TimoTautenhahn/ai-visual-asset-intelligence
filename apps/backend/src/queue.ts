import { prisma } from './db.js';

export type JobType = 'ai_describe';

export interface JobPayload {
  assetId: string;
}

export async function addJob(type: JobType, payload: JobPayload): Promise<string> {
  const job = await prisma.job.create({
    data: {
      type,
      payload: JSON.stringify(payload),
      status: 'pending',
    },
  });
  return job.id;
}

export async function getNextJob(type: JobType): Promise<{ id: string; payload: JobPayload } | null> {
  const job = await prisma.job.findFirst({
    where: { type, status: 'pending' },
    orderBy: { created_at: 'asc' },
  });
  if (!job) return null;
  await prisma.job.update({
    where: { id: job.id },
    data: { status: 'running', attempts: job.attempts + 1, updated_at: new Date() },
  });
  const payload = JSON.parse(job.payload) as JobPayload;
  return { id: job.id, payload };
}

export async function completeJob(jobId: string): Promise<void> {
  await prisma.job.update({
    where: { id: jobId },
    data: { status: 'done', error: null, updated_at: new Date() },
  });
}

export async function failJob(jobId: string, error: string): Promise<void> {
  await prisma.job.update({
    where: { id: jobId },
    data: { status: 'failed', error, updated_at: new Date() },
  });
}

export async function retryJob(jobId: string): Promise<void> {
  await prisma.job.update({
    where: { id: jobId },
    data: { status: 'pending', error: null, updated_at: new Date() },
  });
}

export async function getRecentJobs(limit: number): Promise<{ id: string; type: string; status: string; error: string | null; created_at: Date }[]> {
  const jobs = await prisma.job.findMany({
    take: limit,
    orderBy: { created_at: 'desc' },
    select: { id: true, type: true, status: true, error: true, created_at: true, payload: true },
  });
  return jobs;
}
