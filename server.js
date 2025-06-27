// Módulo 1: Importando as "peças" necessárias
const express = require('express');
const { MercadoPagoConfig, Payment } = require('mercadopago');
const cors = require('cors');

// Módulo 2: Configuração inicial do servidor
const app = express();
app.use(express.json());
app.use(cors());

// Módulo 3: Lendo a "chave secreta" do nosso cofre no Render
const accessToken = process.env.MERCADO_PAGO_TOKEN;

// Verificação de segurança: se a chave não existe, o servidor não liga.
if (!accessToken) {
    console.log("ERRO FATAL: A variável de ambiente MERCADO_PAGO_TOKEN não foi configurada no Render.");
    process.exit(1);
}

// Módulo 4: Configurando o cliente do Mercado Pago com a chave secreta
const client = new MercadoPagoConfig({ accessToken: accessToken });
const payment = new Payment(client);

// Módulo 5: "Memória" temporária para guardar o status dos pagamentos
const pagamentos = {};

// Módulo 6 (v2): Rota para criar pagamentos (PIX ou Cartão)
app.post('/criar-pagamento', async (req, res) => {
    // O corpo do pedido agora vem do frontend (seja PIX ou Cartão)
    const corpoDoPagamento = req.body;
    
    // Adiciona informações da notificação e do pagador
    corpoDoPagamento.notification_url = 'https://servidor-pix-pagamento.onrender.com/webhook';
    corpoDoPagamento.payer = {
        email: req.body.payer.email || 'cliente@exemplo.com',
    };

    try {
        const resultado = await payment.create({ body: corpoDoPagamento });
        
        console.log(`Pagamento criado com ID: ${resultado.id}, Status: ${resultado.status}`);

        // Responde ao frontend com os dados do pagamento
        res.status(201).json({
            id: resultado.id,
            status: resultado.status,
            detail: resultado.status_detail,
        });

    } catch (error) {
        console.error("Erro ao criar pagamento:", error);
        // Se houver erro, devolve a mensagem de erro do Mercado Pago
        const errorMessage = error.cause ? error.cause[0].description : error.message;
        return res.status(500).json({ error: errorMessage });
    }
});
// Módulo 7: Rota para seu site verificar se o pagamento foi aprovado
app.get('/verificar-pagamento/:id', (req, res) => {
    const pagamentoId = req.params.id;
    const infoPagamento = pagamentos[pagamentoId];

    if (!infoPagamento) {
        return res.status(404).json({ status: 'nao_encontrado' });
    }
    return res.json({ status: infoPagamento.status });
});

// Módulo 8: Rota para o Mercado Pago nos avisar que um pagamento foi aprovado
app.post('/webhook', async (req, res) => {
    try {
        const notificacao = req.body;
        if (notificacao.type === 'payment' && notificacao.data.id) {
            console.log(`Webhook recebido para o pagamento: ${notificacao.data.id}`);
            const pagamentoInfo = await payment.get({ id: notificacao.data.id });
            
            if (pagamentoInfo && pagamentoInfo.status === 'approved') {
                console.log(`Status do pagamento ${pagamentoInfo.id} confirmado como APROVADO.`);
                pagamentos[pagamentoInfo.id] = { status: 'approved' };
            }
        }
        res.sendStatus(204); // Responde ao Mercado Pago que recebemos o aviso com sucesso
    } catch (error) {
        console.error("Erro no webhook:", error);
        res.sendStatus(500);
    }
});

// Módulo 9: Comando para ligar o servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});