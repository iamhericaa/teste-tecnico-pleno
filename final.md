1. cd case-eng-dist
2. cd quotation-service
3. npm install
4. npm run dev
5. docker compose up -d --build



Teste de performance - Estruturação
Cenário 1: De 0 a 50.000 em 20 minutos, execução por 30 minutos.
Cenário 2: Stress Test 0 a 75.000 usuário em menos de 5 minutos, para simular o comportamento do sistema
Cenário 3: Soak Test por 4 horas para ver o comportamento da aplicação durante o dia. 
Cenário 4: Spike Test com picos de 100.000 clientes para simular abertura de mercado e recuperação do sistema após o pico. 


Teste integrado: E2E
Sucesso
1. Consulta os ativos na api "leitura ativos"
2. Cria a ordem na api "criar ordens"
3. Consulta o status de processamento - Espero EXECUTADO

Erro
1. Consulta os ativos na api "leitura ativos"
2. Cria a ordem na api "criar ordens"
3. Mock do saldo do cliente insuficiente para a operação (Compra)
4. Consulta o status de processamento - Espero REJEITADO

Erro
1. Consulta os ativos na api "leitura ativos"
2. Erro ao criar a ordem na api "criar ordens"
3. Não cria a ordem. 

Erro
1. Redis fica fora do ar
2. Consulta no banco de dados na api "leitura ativos"
3. Cria a ordem na api "criar ordens" 
4. Consulta o status de processamento - Espero EXECUTADO


Teste sintético
Atualiza-ativos
Cenário: 
1. Deploy sobe
2. Teste sintético aguarda 5 minutos
3. Consulta o dado no banco de dados e Redis
4. Valida que o timestamp ou valor mudou dentro do esperado
5. Passa ou falha a pipeline

Criar-ordens 
Cenário:
1. Envia uma ordem
2. Valida que voltou 201 com status PENDENTE
3. Valida se salvou no banco

Leitura-ativos:
Cenário:
1. Consulta cotação de um ativo conhecido no redis
2. Consulta status de uma ordem no redis e banco de dados
3. Consulta posição do usuário no redis e banco de dados
4. Valida 200 com dados coerentes

Processamento-ativos
Cenário:
1. Publica uma ordem PENDENTE no SQS
2. Aguarda o tempo médio de processamento
3. Consulta o status — valida que foi para EXECUTADO
4. Tenta cancelar — valida que retorna erro (já executada)


1. Publica uma ordem PENDENTE no SQS
3. Consulta o status — valida que está PENDENTE ainda
4. Cancela a ordem 
5. Ordem finaliza com status CANCELADO