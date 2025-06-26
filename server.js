// 1. Importando as "peças" necessárias
const express = require('express');
const mercadopago = require('mercadopago');
const cors = require('cors');

// 2. Configuração inicial do servidor
const app = express();
app.use(express.json()); // Permite que o servidor entenda o formato JSON
app.use(cors()); // Permite que seu site no Google Sites acesse este servidor

// 3. Configurando o Mercado Pago com sua "senha secreta"
// !!! IMPORTANTE: DEPOIS VAMOS SUBSTITUIR PELA SUA CREDENCIAL REAL !!!
mercadopago.configure({
    access_token: 'SEU_ACCESS_TOKEN_DO_MERCADO_PAGO',
});

// 4. Objeto para guardar o status dos pagamentos
const pagamentos = {};

// 5. Rota para criar a cobrança PIX
app.post('/criar-pagamento', async (req, res) => {
    try {
        const dadosPagamento = {
            transaction_amount: 1.00, // <<-- SE QUISER, MUDE AQUI O VALOR DO SEU PRODUTO
            description: 'Inscrição para o evento/curso', // <<-- DESCRIÇÃO QUE APARECERÁ NO PIX
            payment_method_id: 'pix',
            payer: {
                email: 'cliente@email.com',
            },
            // !!! IMPORTANTE: DEPOIS VAMOS SUBSTITUIR PELA SUA URL DO RENDER !!!
            notification_url: 'https://servidor-pix-pagamento.onrender.com/webhook',
        };

        const resultado = await mercadopago.payment.create(dadosPagamento);
        const dadosFrontend = {
            id: resultado.body.id,
            qr_code: resultado.body.point_of_interaction.transaction_data.qr_code,
            qr_code_base64: resultado.body.point_of_interaction.transaction_data.qr_code_base64,
        };

        pagamentos[dadosFrontend.id] = { status: 'pending' };
        console.log(`Pagamento PIX criado com ID: ${dadosFrontend.id}`);
        return res.json(dadosFrontend);

    } catch (error) {
        console.error("Erro ao criar pagamento:", error);
        return res.status(500).json({ error: 'Erro ao criar pagamento.' });
    }
});

// 6. Rota para a página verificar o status
app.get('/verificar-pagamento/:id', (req, res) => {
    const pagamentoId = req.params.id;
    const infoPagamento = pagamentos[pagamentoId];

    if (!infoPagamento) {
        return res.status(404).json({ status: 'nao_encontrado' });
    }

    return res.json({ status: infoPagamento.status });
});

// 7. Rota de Webhook: O Mercado Pago nos avisa aqui quando o pagamento é aprovado
app.post('/webhook', (req, res) => {
    const notificacao = req.body;
    if (notificacao.type === 'payment' && notificacao.data.id) {
        console.log(`Webhook recebido para o pagamento: ${notificacao.data.id}`);
        pagamentos[notificacao.data.id] = { status: 'approved' };
    }
    res.sendStatus(200);
});

// 8. Iniciando o servidor
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});