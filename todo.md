# Sistema de Gestão para Salão de Beleza — TODO

## Banco de Dados & Schema
- [x] Tabela `professionals` (profissionais do salão)
- [x] Tabela `services` (serviços oferecidos com valor e comissão padrão)
- [x] Tabela `commission_rules` (regras de comissão por profissional ou serviço)
- [x] Tabela `appointments` (agendamentos com status)
- [x] Aplicar migrações no banco

## Backend (tRPC)
- [x] CRUD de profissionais
- [x] CRUD de serviços
- [x] CRUD de regras de comissão
- [x] CRUD de agendamentos (sem delete, apenas status)
- [x] Queries de dashboard financeiro (diário, semanal, mensal)
- [x] Cálculo automático de comissões

## Design & Layout
- [x] Paleta de cores elegante (tons neutros + dourado/rose gold)
- [x] Tipografia refinada (fonte serif + sans-serif)
- [x] DashboardLayout com sidebar elegante
- [x] Navegação com controle de acesso por perfil (admin/profissional)
- [x] Responsividade mobile-first

## Telas — Agenda
- [x] Visualização em calendário mensal
- [x] Visualização em lista semanal/diária
- [x] Formulário de novo agendamento
- [x] Modal de edição de agendamento
- [x] Filtros por profissional e data
- [x] Controle de status (Concluído / Cancelado / Agendado)

## Telas — Cadastros (Admin)
- [x] Listagem e cadastro de profissionais
- [x] Listagem e cadastro de serviços
- [x] Configuração de regras de comissão por profissional
- [x] Configuração de regras de comissão por serviço

## Telas — Dashboard Financeiro (Admin only)
- [x] Cards de resumo: faturamento e comissão do dia
- [x] Gráfico de faturamento semanal
- [x] Resumo mensal com comissão por profissional
- [x] Tabela de comissões para pagamento

## Telas — Profissional
- [x] Agenda própria e compartilhada
- [x] Visualização de atendimentos do dia

## Testes
- [x] Testes de procedures de agendamento
- [x] Testes de cálculo de comissão
- [x] Testes de controle de acesso (admin vs profissional)
- [x] 15/15 testes passando

## Atualizações — Comissões e Dashboard
- [x] Configurar comissões por serviço: 50% (escova, coloração, luzes, botox, mega, selagem, manutenção mega), 60% (pé, mão, SPA pés, buço, sobrancelha, sobranc c/henna, nariz, esmaltação), 70% (gel, manutenção gel)
- [x] Criar/refatorar DashboardPage com visões diária, semanal e mensal exclusivas para Admin
- [x] Bloquear acesso ao dashboard para perfil Profissional (redirecionar para agenda)
- [x] Corrigir schema Drizzle: professionalId nullable em commission_rules
- [x] Corrigir erros TypeScript após mudança de schema (CommissionsPage + db.ts)

## Sistema de Login Próprio (usuário + senha)
- [x] Adicionar campos `username` e `passwordHash` na tabela `users` do schema Drizzle
- [x] Criar endpoint tRPC `auth.login` (verifica username/senha, cria sessão JWT)
- [x] Criar endpoint tRPC `auth.logout` (limpa cookie de sessão)
- [x] Criar endpoint tRPC `auth.me` baseado na sessão JWT própria
- [x] Criar tela de login elegante com campos usuário e senha
- [x] Remover dependência do OAuth Manus do frontend (substituir por login próprio)
- [x] Adaptar DashboardLayout para usar o novo sistema de auth
- [x] Cadastrar admin: login=admin, senha=admin123, role=admin
- [x] Cadastrar profissionais: Marta/marta, Bia/bia, Glei/glei, Janaina/janaina, Maysa/maysa, Viviane/viviane (role=user)
- [x] Garantir que profissionais não vejam Dashboard Financeiro no menu

## Melhorias na Agenda
- [x] Adicionar card "Comissão do Dia" abaixo do card de atendimentos/faturamento na agenda
