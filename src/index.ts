import * as dotenv from 'dotenv';
import TelegramBot from 'node-telegram-bot-api';

dotenv.config();

// Configs
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN!;
const TELEGRAM_API_URL = 'https://api.telegram.org';

if (!TELEGRAM_TOKEN) {
  throw new Error('TELEGRAM_TOKEN must be provided!');
}

const bot = new TelegramBot(TELEGRAM_TOKEN, {
  polling: true,
  request: {
    url: TELEGRAM_API_URL,
    agentOptions: {
      keepAlive: true,
      family: 4
    },
  }
});

// Estado para controlar o fluxo da conversa e armazenar dados do usuário
interface UserData {
  state: string;
  fullName?: string;
  time?: string;
  hasAppointment?: boolean;
}

const userStates: { [key: number]: UserData } = {};

// Função para verificar se o horário está dentro do período de funcionamento (8h às 18h)
function isValidTime(time: string): boolean {
  const [hours] = time.split(':').map(Number);
  return hours >= 8 && hours < 18;
}

// Handler para mensagens iniciais
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  // console.log(`Received message from ${chatId}: ${msg.text}`);

  // Se o usuário não estiver em nenhum estado, enviar mensagem inicial
  if (!userStates[chatId]) {
    userStates[chatId] = { state: 'awaiting_full_name' };

    const welcomeMessage = `Olá! Eu sou o assistente virtual da Barbearia do Lucas! 🪒\n\n` +
      `Para fazer seu agendamento, primeiro preciso de algumas informações.\n` +
      `Por favor, me informe seu primeiro e segundo nome:`;

    await bot.sendMessage(chatId, welcomeMessage);
    return;
  }

  // Aguardando o nome
  if (userStates[chatId].state === 'awaiting_full_name') {
    const fullName = msg.text?.trim();
    
    if (!fullName) {
      await bot.sendMessage(chatId, 'Por favor, me informe seu primeiro e segundo nome:');
      return;
    }

    userStates[chatId].fullName = fullName;
    userStates[chatId].state = 'awaiting_time';
    
    await bot.sendMessage(
      chatId,
      `Obrigado! Nosso horário de funcionamento é das 8h às 18h.\n` +
      `Por favor, me informe qual horário você gostaria de agendar (exemplo: 14:30):`
    );
    return;
  }

  // Se estiver aguardando o horário
  if (userStates[chatId].state === 'awaiting_time') {
    const requestedTime = msg.text?.trim();

    if (!requestedTime || !/^\d{1,2}:\d{2}$/.test(requestedTime)) {
      await bot.sendMessage(chatId, 'Por favor, informe um horário válido no formato HH:MM (exemplo: 14:30)');
      return;
    }

    if (!isValidTime(requestedTime)) {
      await bot.sendMessage(
        chatId,
        'Desculpe, mas nosso horário de funcionamento é das 8h às 18h. Por favor, escolha outro horário:'
      );
      return;
    }

    const userData = userStates[chatId];

    // Confirmar agendamento
    userStates[chatId].hasAppointment = true;
    userStates[chatId].time = requestedTime;
    const successMessage = `✅ Ótimo, ${userData.fullName}! Seu horário foi agendado com sucesso para ${requestedTime}.\n\n` +
      'Esperamos você, na Barbearia do Lucas!\n' +
      'Para cancelar seu agendamento, digite /cancelar';

    await bot.sendMessage(chatId, successMessage);

    // Enviar notificação para um chatId específico
    const adminChatId = process.env.ADMIN_CHAT_ID!;
    const notificationMessage = `Novo agendamento:\n\nCliente: ${userData.fullName}\nHorário: ${requestedTime}`;
    await bot.sendMessage(adminChatId, notificationMessage);

    // Manter apenas dados do agendamento
    userStates[chatId] = {
      state: 'has_appointment',
      fullName: userData.fullName,
      time: requestedTime,
      hasAppointment: true
    };
  }
});

// Handler para cancelamento de agendamento
bot.onText(/\/cancelar/, async (msg) => {
  const chatId = msg.chat.id;
  const userData = userStates[chatId];

  if (!userData?.hasAppointment) {
    await bot.sendMessage(chatId, 'Você não possui nenhum agendamento para cancelar.');
    return;
  }

  const cancelMessage = `❌ ${userData.fullName}, seu agendamento para ${userData.time} foi cancelado com sucesso.`;
  await bot.sendMessage(chatId, cancelMessage);

  // Notificar admin sobre o cancelamento
  const adminChatId = process.env.ADMIN_CHAT_ID!;
  const notificationMessage = `Cancelamento de agendamento:\n\nCliente: ${userData.fullName}\nHorário: ${userData.time}`;
  await bot.sendMessage(adminChatId, notificationMessage);

  // Limpar dados do agendamento
  delete userStates[chatId];
});

console.log('Bot da Barbearia do Lucas está rodando!');
