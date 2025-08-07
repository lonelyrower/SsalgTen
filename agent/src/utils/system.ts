import os from 'os';
import fs from 'fs';
import { promisify } from 'util';
import { SystemInfo } from '@/types';

const exec = promisify(require('child_process').exec);

// 获取 CPU 使用率
export const getCpuUsage = async (): Promise<number> => {
  return new Promise((resolve) => {
    const startMeasure = process.cpuUsage();
    const startTime = process.hrtime.bigint();
    
    setTimeout(() => {
      const currentMeasure = process.cpuUsage(startMeasure);
      const currentTime = process.hrtime.bigint();
      
      const elapsedTime = Number(currentTime - startTime) / 1000000; // Convert to milliseconds
      const elapsedUserTime = currentMeasure.user / 1000; // Convert to milliseconds
      const elapsedSystemTime = currentMeasure.system / 1000;
      const cpuPercent = Math.min(100, ((elapsedUserTime + elapsedSystemTime) / elapsedTime) * 100);
      
      resolve(Math.round(cpuPercent * 100) / 100);
    }, 100);
  });
};

// 获取内存使用情况
export const getMemoryUsage = () => {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  
  return {
    total: Math.round(totalMemory / 1024 / 1024), // MB
    used: Math.round(usedMemory / 1024 / 1024),   // MB
    free: Math.round(freeMemory / 1024 / 1024)    // MB
  };
};

// 获取磁盘使用情况
export const getDiskUsage = async (): Promise<{ total: number; used: number; free: number }> => {
  try {
    if (os.platform() === 'win32') {
      // Windows
      const { stdout } = await exec('wmic logicaldisk size,freespace,caption');
      const lines = stdout.trim().split('\n').slice(1);
      let totalSize = 0, totalFree = 0;
      
      for (const line of lines) {
        const [caption, freeSpace, size] = line.trim().split(/\s+/);
        if (size && freeSpace) {
          totalSize += parseInt(size);
          totalFree += parseInt(freeSpace);
        }
      }
      
      return {
        total: Math.round(totalSize / 1024 / 1024 / 1024), // GB
        free: Math.round(totalFree / 1024 / 1024 / 1024),  // GB
        used: Math.round((totalSize - totalFree) / 1024 / 1024 / 1024) // GB
      };
    } else {
      // Linux/Unix
      const { stdout } = await exec("df -BG / | tail -1 | awk '{print $2, $3, $4}'");
      // 修复这一行 - 添加类型注解
      const [total, used, free] = stdout.trim().split(/\s+/).map((s: string) => parseInt(s.replace('G', '')));
      
      return { total, used, free };
    }
  } catch (error) {
    return { total: 0, used: 0, free: 0 };
  }
};

// 获取网络接口信息
export const getNetworkInterface = (): string => {
  const interfaces = os.networkInterfaces();
  
  for (const [name, addrs] of Object.entries(interfaces)) {
    if (addrs) {
      for (const addr of addrs) {
        if (addr.family === 'IPv4' && !addr.internal) {
          return `${name} (${addr.address})`;
        }
      }
    }
  }
  
  return 'Unknown';
};

// 获取完整系统信息
export const getSystemInfo = async (): Promise<SystemInfo> => {
  const [cpuUsage, diskUsage] = await Promise.all([
    getCpuUsage(),
    getDiskUsage()
  ]);
  
  const memoryInfo = getMemoryUsage();
  
  return {
    platform: `${os.type()} ${os.release()}`,
    arch: os.arch(),
    hostname: os.hostname(),
    version: os.version ? os.version() : os.release(),
    cpuUsage,
    memoryUsage: memoryInfo.used / memoryInfo.total * 100, // 转换为百分比
    diskUsage: diskUsage.total > 0 ? diskUsage.used / diskUsage.total * 100 : 0, // 转换为百分比
    memory: memoryInfo,
    disk: diskUsage,
    networkInterface: getNetworkInterface(),
    uptime: Math.round(os.uptime()),
    loadAverage: os.loadavg(),
    cpuCount: os.cpus().length,
    nodeVersion: process.version
  };
};