import os from 'os';
import fs from 'fs';
import { promisify } from 'util';
import { SystemInfo, CPUInfo, MemoryInfo, DiskInfo, NetworkStats, ProcessInfo } from '../types';

const exec = promisify(require('child_process').exec);
const readFile = promisify(fs.readFile);

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

// 获取详细CPU信息
export const getCPUInfo = async (): Promise<CPUInfo> => {
  try {
    const cpus = os.cpus();
    const cpuUsage = await getCpuUsage();
    
    let model = cpus[0]?.model || 'Unknown';
    let frequency = cpus[0]?.speed || 0;
    let temperature: number | undefined = undefined;
    
    if (os.platform() === 'linux') {
      try {
        // 尝试从 /proc/cpuinfo 获取更详细信息
        const cpuinfo = await readFile('/proc/cpuinfo', 'utf8');
        const modelMatch = cpuinfo.match(/model name\s*:\s*(.+)/);
        if (modelMatch) model = modelMatch[1].trim();
        
        // 尝试获取CPU温度
        try {
          const temp = await readFile('/sys/class/thermal/thermal_zone0/temp', 'utf8');
          temperature = parseInt(temp.trim()) / 1000; // 转换为摄氏度
        } catch {}
      } catch {}
    } else if (os.platform() === 'win32') {
      try {
        const { stdout } = await exec('wmic cpu get Name,MaxClockSpeed,NumberOfCores,NumberOfLogicalProcessors /format:csv');
        const lines = stdout.trim().split('\n').slice(1);
        if (lines.length > 1) {
          const parts = lines[1].split(',');
          if (parts.length >= 4) {
            frequency = parseInt(parts[1]) || frequency;
            model = parts[2] || model;
          }
        }
      } catch {}
    }
    
    return {
      model,
      cores: cpus.length,
      threads: cpus.length, // 简化处理
      frequency,
      architecture: os.arch(),
      usage: cpuUsage,
      temperature
    };
  } catch (error) {
    const cpus = os.cpus();
    return {
      model: cpus[0]?.model || 'Unknown',
      cores: cpus.length,
      threads: cpus.length,
      frequency: cpus[0]?.speed || 0,
      architecture: os.arch(),
      usage: 0,
    };
  }
};

// 获取详细内存信息
export const getDetailedMemoryInfo = async (): Promise<MemoryInfo> => {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  
  let availableMemory = freeMemory;
  let memoryType: string | undefined = undefined;
  let memorySpeed: number | undefined = undefined;
  
  if (os.platform() === 'linux') {
    try {
      const meminfo = await readFile('/proc/meminfo', 'utf8');
      const availableMatch = meminfo.match(/MemAvailable:\s*(\d+)\s*kB/);
      if (availableMatch) {
        availableMemory = parseInt(availableMatch[1]) * 1024; // 转换为字节
      }
      
      // 尝试获取内存类型和速度
      try {
        const { stdout } = await exec("dmidecode -t memory 2>/dev/null | grep -E '(Type:|Speed:)' | head -2");
        const lines = stdout.trim().split('\n');
        for (const line of lines) {
          if (line.includes('Type:') && !line.includes('Type Detail:')) {
            memoryType = line.split(':')[1]?.trim();
          } else if (line.includes('Speed:')) {
            const speedMatch = line.match(/(\d+)\s*MT\/s/);
            if (speedMatch) memorySpeed = parseInt(speedMatch[1]);
          }
        }
      } catch {}
    } catch {}
  } else if (os.platform() === 'win32') {
    try {
      const { stdout } = await exec('wmic memorychip get MemoryType,Speed /format:csv');
      const lines = stdout.trim().split('\n').slice(1);
      if (lines.length > 1) {
        const parts = lines[1].split(',');
        if (parts.length >= 2) {
          const typeCode = parseInt(parts[1]);
          // DDR类型码转换
          memoryType = typeCode === 24 ? 'DDR3' : typeCode === 26 ? 'DDR4' : typeCode === 28 ? 'DDR5' : 'Unknown';
          memorySpeed = parseInt(parts[2]) || undefined;
        }
      }
    } catch {}
  }
  
  return {
    total: Math.round(totalMemory / 1024 / 1024), // MB
    used: Math.round(usedMemory / 1024 / 1024),   // MB
    free: Math.round(freeMemory / 1024 / 1024),   // MB
    available: Math.round(availableMemory / 1024 / 1024), // MB
    usage: Math.round((usedMemory / totalMemory) * 100),
    type: memoryType,
    speed: memorySpeed
  };
};

// 获取详细磁盘信息
export const getDetailedDiskInfo = async (): Promise<DiskInfo> => {
  try {
    const basicDisk = await getDiskUsage();
    let diskType: string | undefined = undefined;
    let diskModel: string | undefined = undefined;
    let diskHealth: string | undefined = undefined;
    let diskTemp: number | undefined = undefined;
    
    if (os.platform() === 'linux') {
      try {
        // 检测磁盘类型
        const { stdout: lsblk } = await exec("lsblk -d -o name,rota 2>/dev/null | grep -v NAME");
        const lines = lsblk.trim().split('\n');
        if (lines.length > 0) {
          const parts = lines[0].trim().split(/\s+/);
          if (parts.length >= 2) {
            diskType = parts[1] === '1' ? 'HDD' : 'SSD';
          }
        }
        
        // 获取磁盘型号
        try {
          const { stdout: model } = await exec("lsblk -d -o name,model 2>/dev/null | grep -v MODEL | head -1");
          const modelMatch = model.trim().split(/\s+/);
          if (modelMatch.length >= 2) {
            diskModel = modelMatch.slice(1).join(' ');
          }
        } catch {}
        
        // 尝试获取SMART信息
        try {
          const { stdout: smart } = await exec("smartctl -A /dev/sda 2>/dev/null | grep -E '(Temperature|Health)'");
          if (smart.includes('PASSED')) diskHealth = 'Good';
          const tempMatch = smart.match(/Temperature_Celsius.*?(\d+)/);
          if (tempMatch) diskTemp = parseInt(tempMatch[1]);
        } catch {}
      } catch {}
    } else if (os.platform() === 'win32') {
      try {
        const { stdout } = await exec('wmic diskdrive get Model,MediaType /format:csv');
        const lines = stdout.trim().split('\n').slice(1);
        if (lines.length > 1) {
          const parts = lines[1].split(',');
          if (parts.length >= 2) {
            diskType = parts[1]?.includes('SSD') ? 'SSD' : 'HDD';
            diskModel = parts[2] || undefined;
          }
        }
      } catch {}
    }
    
    return {
      total: basicDisk.total,
      used: basicDisk.used,
      free: basicDisk.free,
      usage: basicDisk.total > 0 ? Math.round((basicDisk.used / basicDisk.total) * 100) : 0,
      type: diskType,
      model: diskModel,
      health: diskHealth,
      temperature: diskTemp
    };
  } catch (error) {
    const basicDisk = await getDiskUsage();
    return {
      total: basicDisk.total,
      used: basicDisk.used,
      free: basicDisk.free,
      usage: basicDisk.total > 0 ? Math.round((basicDisk.used / basicDisk.total) * 100) : 0,
    };
  }
};

// 获取网络统计信息
export const getNetworkStats = async (): Promise<NetworkStats[]> => {
  const interfaces = os.networkInterfaces();
  const stats: NetworkStats[] = [];
  
  if (os.platform() === 'linux') {
    try {
      // 读取网络统计
      const netdev = await readFile('/proc/net/dev', 'utf8');
      const lines = netdev.trim().split('\n').slice(2); // 跳过头部
      
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 17) {
          const iface = parts[0].replace(':', '');
          if (interfaces[iface] && !interfaces[iface]![0]?.internal) {
            stats.push({
              interface: iface,
              bytesReceived: parseInt(parts[1]) || 0,
              bytesSent: parseInt(parts[9]) || 0,
              packetsReceived: parseInt(parts[2]) || 0,
              packetsSent: parseInt(parts[10]) || 0,
            });
          }
        }
      }
      
      // 尝试获取网络速度
      for (const stat of stats) {
        try {
          const speed = await readFile(`/sys/class/net/${stat.interface}/speed`, 'utf8');
          stat.speed = parseInt(speed.trim());
          
          const duplex = await readFile(`/sys/class/net/${stat.interface}/duplex`, 'utf8');
          stat.duplex = duplex.trim();
        } catch {}
      }
    } catch {}
  } else if (os.platform() === 'win32') {
    // Windows网络统计获取较复杂，这里提供基础实现
    try {
      for (const [name, addrs] of Object.entries(interfaces)) {
        if (addrs && !addrs[0]?.internal) {
          stats.push({
            interface: name,
            bytesReceived: 0, // Windows需要WMI查询，暂时设为0
            bytesSent: 0,
            packetsReceived: 0,
            packetsSent: 0,
          });
        }
      }
    } catch {}
  }
  
  return stats.length > 0 ? stats : [{
    interface: getNetworkInterface(),
    bytesReceived: 0,
    bytesSent: 0,
    packetsReceived: 0,
    packetsSent: 0,
  }];
};

// 获取进程信息
export const getProcessInfo = async (): Promise<ProcessInfo> => {
  try {
    if (os.platform() === 'linux') {
      const stat = await readFile('/proc/stat', 'utf8');
      const processLine = stat.split('\n').find(line => line.startsWith('processes'));
      const total = processLine ? parseInt(processLine.split(' ')[1]) || 0 : 0;
      
      // 从 /proc/loadavg 获取运行进程数
      const loadavg = await readFile('/proc/loadavg', 'utf8');
      const parts = loadavg.trim().split(' ');
      const running = parts[3] ? parseInt(parts[3].split('/')[0]) || 0 : 0;
      
      return {
        total,
        running,
        sleeping: Math.max(0, total - running),
        zombie: 0 // 简化处理
      };
    } else {
      // Windows或其他平台的简化处理
      return {
        total: 0,
        running: 0,
        sleeping: 0,
        zombie: 0
      };
    }
  } catch {
    return {
      total: 0,
      running: 0,
      sleeping: 0,
      zombie: 0
    };
  }
};

// 检测虚拟化环境
export const getVirtualizationInfo = async () => {
  try {
    if (os.platform() === 'linux') {
      // 检查常见虚拟化标识
      try {
        const dmi = await exec('dmidecode -s system-product-name 2>/dev/null');
        const product = dmi.stdout.toLowerCase();
        
        if (product.includes('vmware')) return { type: 'VMware' };
        if (product.includes('virtualbox')) return { type: 'VirtualBox' };
        if (product.includes('kvm')) return { type: 'KVM' };
        if (product.includes('xen')) return { type: 'Xen' };
      } catch {}
      
      // 检查 /proc/cpuinfo
      try {
        const cpuinfo = await readFile('/proc/cpuinfo', 'utf8');
        if (cpuinfo.includes('hypervisor')) {
          return { type: 'Hypervisor' };
        }
      } catch {}
      
      // 检查云服务商
      try {
        const vendor = await exec('dmidecode -s bios-vendor 2>/dev/null');
        const biosVendor = vendor.stdout.toLowerCase();
        if (biosVendor.includes('amazon')) return { type: 'KVM', provider: 'AWS' };
        if (biosVendor.includes('google')) return { type: 'KVM', provider: 'GCP' };
        if (biosVendor.includes('microsoft')) return { type: 'Hyper-V', provider: 'Azure' };
      } catch {}
    }
  } catch {}
  
  return undefined;
};

// 检查系统服务状态
export const getServicesStatus = async () => {
  const services = {
    docker: false,
    nginx: false,
    apache: false,
    mysql: false,
    postgresql: false,
    redis: false,
  };
  
  try {
    if (os.platform() === 'linux') {
      const checks = [
        { name: 'docker', command: 'systemctl is-active docker 2>/dev/null' },
        { name: 'nginx', command: 'systemctl is-active nginx 2>/dev/null' },
        { name: 'apache', command: 'systemctl is-active apache2 2>/dev/null || systemctl is-active httpd 2>/dev/null' },
        { name: 'mysql', command: 'systemctl is-active mysql 2>/dev/null || systemctl is-active mysqld 2>/dev/null' },
        { name: 'postgresql', command: 'systemctl is-active postgresql 2>/dev/null' },
        { name: 'redis', command: 'systemctl is-active redis 2>/dev/null || systemctl is-active redis-server 2>/dev/null' },
      ];
      
      for (const check of checks) {
        try {
          const { stdout } = await exec(check.command);
          services[check.name as keyof typeof services] = stdout.trim() === 'active';
        } catch {}
      }
    } else if (os.platform() === 'win32') {
      // Windows服务检查
      try {
        const { stdout } = await exec('tasklist /svc /fo csv');
        services.docker = stdout.includes('dockerd') || stdout.includes('Docker Desktop');
        services.nginx = stdout.includes('nginx');
        services.apache = stdout.includes('httpd') || stdout.includes('apache');
        services.mysql = stdout.includes('mysqld');
        services.postgresql = stdout.includes('postgres');
        services.redis = stdout.includes('redis');
      } catch {}
    }
  } catch {}
  
  return services;
};

// 获取完整系统信息
export const getSystemInfo = async (): Promise<SystemInfo> => {
  const [
    cpuInfo,
    memoryInfo, 
    diskInfo,
    networkStats,
    processInfo,
    virtualization,
    services,
    basicCpuUsage,
    basicDiskUsage
  ] = await Promise.all([
    getCPUInfo(),
    getDetailedMemoryInfo(),
    getDetailedDiskInfo(), 
    getNetworkStats(),
    getProcessInfo(),
    getVirtualizationInfo(),
    getServicesStatus(),
    getCpuUsage(),
    getDiskUsage()
  ]);
  
  return {
    // 基本系统信息
    platform: `${os.type()} ${os.release()}`,
    arch: os.arch(),
    hostname: os.hostname(),
    version: os.version ? os.version() : os.release(),
    uptime: Math.round(os.uptime()),
    nodeVersion: process.version,
    
    // CPU信息
    cpu: cpuInfo,
    cpuUsage: basicCpuUsage, // 兼容性保留
    cpuCount: cpuInfo.cores, // 兼容性保留
    
    // 内存信息
    memory: memoryInfo,
    memoryUsage: memoryInfo.usage, // 兼容性保留
    
    // 磁盘信息
    disk: diskInfo,
    diskUsage: diskInfo.usage, // 兼容性保留
    
    // 网络信息
    network: networkStats,
    networkInterface: getNetworkInterface(), // 兼容性保留
    
    // 系统负载和进程
    loadAverage: os.loadavg(),
    processes: processInfo,
    
    // 虚拟化和服务信息
    virtualization,
    services,
  };
};