// 1. Importando as "peças" da nova versão do Mercado Pago
const express = require('express');
const { MercadoPagoConfig, Payment } = require('mercadopago');
const cors = require('cors');

// 2. Configuração inicial do servidor
const app = express();
app.use(express.json());
app.use(cors());

// 3. Lendo a "chave secreta" do nosso cofre no Render (Variáveis de Ambiente)
const accessToken = process.env.MERCADO_PAGO_TOKEN;

// Se a chave não estiver configurada, avisa no log e encerra.
if (!accessToken) {
    console.log("Erro: A variável de ambiente MERCADO_PAGO_TOKEN não está configurada.");
    process.exit(1);
}

// 4. Configurando o cliente do Mercado Pago com a chave secreta (Sintaxe da v2)
const client = new MercadoPagoConfig({ accessToken: accessToken });
const payment = new Payment(client);

// 5. Objeto para guardar o status dos pagamentos
const pagamentos = {};

// 6. Rota para criar a cobrança PIX
app.post('/criar-pagamento', async (req, res) => {
    try {
        const body = {
            transaction_amount: 1.00, // <<-- VALOR DO PRODUTO
            description: 'Inscrição para o evento/curso', // <<-- DESCRIÇÃO
            payment_method_id: 'pix',
            payer: {
                email: 'cliente@exemplo.com',
            },
            notification_url: notification_url: 'https://servidor-pix-pagamento.onrender.com/webhook', // <<-- IMPORTANTE: SUBSTITUIR DEPOIS
        };

        const resultado = await payment.create({ body });
        
        const dadosFrontend = {
            id: resultado.id,
            qr_code: resultado.point_of_interaction.transaction_data.qr_code,
            qr_code_base64: resultado.point_of_interaction.transaction_data.qr_code_base64,
        };

        pagamentos[dadosFrontend.id] = { status: 'pending' };
        console.log(`Pagamento PIX criado com ID: ${dadosFrontend.id}`);
        return res.json(dadosFrontend);

    } catch (error) {
        console.error("Erro ao criar pagamento:", error.cause || error.message);
        return res.status(500).json({ error: 'Erro ao criar pagamento.' });
    }
});

// 7. Rota para a página verificar o status
app.get('/verificar-pagamento/:id', (req, res) => {
    const pagamentoId = req.params.id;
    const infoPagamento = pagamentos[pagamentoId];

    if (!infoPagamento) {
        return res.status(404).json({ status: 'nao_encontrado' });
    }
    return res.json({ status: infoPagamento.status });
});

// 8. Rota de Webhook
app.post('/webhook', async (req, res) => {
    try {
        const query = req.query;
        if (query.type === 'payment') {
            const paymentInfo = await payment.get({ id: query['data.id'] });
            console.log(`Webhook recebido. Status do pagamento ${paymentInfo.id}: ${paymentInfo.status}`);
            if (paymentInfo.status === 'approved') {
                pagamentos[paymentInfo.id] = { status: 'approved' };
            }
        }
        res.sendStatus(204);
    } catch (error) {
        console.error("Erro no webhook:", error);
        res.sendStatus(500);
    }
});

// 9. Iniciando o servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});