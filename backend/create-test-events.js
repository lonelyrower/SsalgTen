const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createTestEvents() {
  try {
    // Get first node ID 
    const node = await prisma.node.findFirst();
    if (!node) {
      console.log('No nodes found in database');
      return;
    }

    console.log(`Creating test events for node: ${node.name} (${node.id})`);

    // Create several test events
    const testEvents = [
      {
        nodeId: node.id,
        type: 'AGENT_REGISTERED',
        message: 'Agent successfully registered and started monitoring',
        details: { agentId: node.agentId, platform: 'Linux', hostname: node.hostname }
      },
      {
        nodeId: node.id,
        type: 'STATUS_CHANGED',
        message: 'Node status changed from offline to online',
        details: { from: 'offline', to: 'online' }
      },
      {
        nodeId: node.id,
        type: 'IP_CHANGED',
        message: 'Node public IP address has been updated',
        details: { previous: { ipv4: '1.2.3.4' }, current: { ipv4: node.ipv4 } }
      },
      {
        nodeId: node.id,
        type: 'HEARTBEAT_RECEIVED',
        message: 'Regular heartbeat received from agent',
        details: { status: 'healthy', uptime: 86400 }
      }
    ];

    // Insert events with different timestamps
    for (let i = 0; i < testEvents.length; i++) {
      await prisma.eventLog.create({
        data: {
          ...testEvents[i],
          timestamp: new Date(Date.now() - (i * 5 * 60 * 1000)) // 5 minutes apart
        }
      });
    }

    console.log(`Created ${testEvents.length} test events successfully`);
  } catch (error) {
    console.error('Error creating test events:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestEvents();