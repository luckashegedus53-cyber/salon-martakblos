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
- [x] Adicionar bloco de comissões individuais por profissional na agenda (soma do dia por profissional)
- [x] Adicionar aba "Comissões" no Dashboard Financeiro (admin) com tabela de comissões por profissional e filtro de período
- [x] Corrigir aba Comissões do Dashboard: padrão "Hoje", adicionar filtro de dia, mostrar valor ganho no dia por profissional

## Bugs
- [x] Bug: agendamento mostra sucesso mas não aparece na agenda (investigar logs — funcionando corretamente)
- [x] Remover blocos "Comissão do Dia" e "Comissão por Profissional" da agenda
- [x] Corrigir bug de fuso horário no agendamento (agendamento aparece no dia errado)
- [x] Bug crítico: novo agendamento não está sendo salvo (resolvido: erro de parse no DashboardPage causava reinicialização do servidor)
- [x] Bug crítico: agendamento não aparecia na agenda (resolvido: fuso horário — scheduledAt não estava zerando a hora antes de aplicar o horário selecionado + erro de parse no DashboardPage)
- [x] Bug: agendamentos aparecem duplicados na agenda (resolvido: find prioriza agendamento ativo sobre cancelado no mesmo slot)
- [x] Bug: cancelar/apagar agendamento não funciona (resolvido: invalidate do cache após updateStatus + fuso horário)
- [x] Bug: Dashboard Financeiro não reflete os agendamentos em tempo real (resolvido: filtro inclui scheduled+completed, exclui apenas cancelled; fuso horário BRT corrigido)
- [x] Zerar saldo: apagar todos os agendamentos de teste do banco (33 agendamentos removidos)
- [x] Verificar e corrigir comissões da Bia: removida regra genérica 50% que sobrescrevia as regras globais por serviço
- [x] Bug: comissão calculada R$ 218,00 mas deveria ser R$ 230,00 (resolvido: Corte não tinha regra de comissão, usava 40% padrão)
- [x] Adicionar regra de comissão 50% para o serviço Corte no banco
- [x] Recalcular commissionValue dos agendamentos existentes com Corte (de 40% para 50%) - total agora R$ 230,00
- [x] Adicionar serviço "Aplicação de Color" com valor R$ 100,00 e regra de comissão 50%
- [x] Campo de valor do serviço editável no formulário de agendamento (profissionais podem alterar o preço na hora)
- [x] Campo de valor aceita até 6 dígitos (máximo R$ 999.999,99)
- [x] Corrigir campo de valor para aceitar formato brasileiro (vírgula decimal, ex: 1.200,00) — substituir type=number por input texto com máscara monetária
- [x] Adicionar serviço "Pé + Mão" com valor R$ 80,00 e comissão 60%
- [x] Sincronizar todas as regras de comissão globais conforme tabela oficial (50%/60%/70%) e recalcular agendamentos ativos
- [x] Bug: comissão R$ 778 em vez de R$ 790 — ID:64 (Corte da Glei) estava com 40% em vez de 50%; corrigido para R$ 790,00
- [x] Bug: lucro no dashboard estava em R$ 231,00 — corrigido: agendamento id:55 (Corte da Glei) atualizado de 40% para 50%, total agora R$ 243,00
