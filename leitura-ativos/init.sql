-- =====================================================
-- Script de inicialização do banco de dados
-- Sistema de Ordens de Investimento
-- =====================================================

-- Criação do banco (já criado no docker-compose, mas garantimos uso)
SET NAMES utf8mb4;
SET character_set_client = utf8mb4;
SET character_set_connection = utf8mb4;
SET character_set_results = utf8mb4;
USE investment_orders;

-- =====================================================
-- Tabela de ativos disponíveis
-- =====================================================
CREATE TABLE IF NOT EXISTS assets (
    symbol VARCHAR(10) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    reference_price DECIMAL(15, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- =====================================================
-- Tabela de usuários
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- =====================================================
-- Tabela de posições (saldo do usuário em cada ativo)
-- =====================================================
CREATE TABLE IF NOT EXISTS positions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    symbol VARCHAR(10) NOT NULL,
    quantity DECIMAL(15, 8) NOT NULL DEFAULT 0,
    average_price DECIMAL(15, 2) NOT NULL DEFAULT 0,
    total_value DECIMAL(15, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_user_symbol (user_id, symbol),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (symbol) REFERENCES assets(symbol) ON DELETE CASCADE
);

-- =====================================================
-- Tabela de ordens
-- =====================================================
CREATE TABLE IF NOT EXISTS orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    symbol VARCHAR(10) NOT NULL,
    type ENUM('COMPRA', 'VENDA') NOT NULL,
    quantity DECIMAL(15, 8) NOT NULL,
    price DECIMAL(15, 2) NOT NULL,
    status ENUM('PENDENTE', 'PROCESSANDO', 'EXECUTADA', 'REJEITADA', 'CANCELADA') NOT NULL DEFAULT 'PENDENTE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (symbol) REFERENCES assets(symbol) ON DELETE CASCADE
);

-- =====================================================
-- Índices para performance
-- =====================================================
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_symbol ON orders(symbol);
CREATE INDEX idx_positions_user_id ON positions(user_id);

-- =====================================================
-- Dados iniciais (SEED)
-- =====================================================

-- Inserir ativos disponíveis
INSERT INTO assets (symbol, name, reference_price) VALUES
    ('ITUB4', 'Itaú Unibanco PN', 32.80),
    ('ITUB3', 'Itaú Unibanco ON', 15.40),
    ('USDC', 'USD Coin', 5.50),
    ('SOL', 'Solana', 418.07),
    ('BTC', 'Bitcoin', 350000.00),
    ('ETH', 'Ethereum', 18500.00),
    ('HRC', 'Teste', 100.00);

-- Inserir usuário de teste
INSERT INTO users (id, name) VALUES
    ('user-001', 'João Investidor'),
    ('user-002', 'Herica Investidora'),
    ('user-003', 'Investidor Saldo Baixo');


-- Inserir saldo inicial do usuário
INSERT INTO positions (user_id, symbol, quantity, average_price) VALUES
    ('user-001', 'ITUB4', 100, 30.00),
    ('user-001', 'USDC', 50, 3.94),
    ('user-002', 'HRC', 10, 100.00);

-- =====================================================
-- Confirmação
-- =====================================================
SELECT 'Banco de dados inicializado com sucesso!' AS mensagem;
SELECT * FROM assets;
SELECT * FROM users;
SELECT * FROM positions;
