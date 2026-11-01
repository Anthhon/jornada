# Roadmap — Jornada

Este documento acompanha a implementação do Jornada a partir dos requisitos funcionais do front-end, do planejamento técnico e do código encontrado no repositório.

## Legenda

- [x] Implementado no código consultado.
- [~] Implementado parcialmente, existe a estrutura ou parte do fluxo, mas falta integração, validação ou cobertura.
- [ ] Pendente ou não foi possível confirmar sua implementação.
- [!] Ponto de atenção: há inconsistência documental ou decisão técnica que precisa ser resolvida.

> **Critério de marcação:** um requisito só é considerado concluído quando existe implementação verificável. Um modelo Django, isoladamente, não comprova que o fluxo de interface, as permissões e os testes estejam prontos.

---

## 1. Fundação do projeto

- [x] Estrutura separada para `back-end/`, `front-end/` e `tools/`.
- [x] Projeto Django configurado.
- [x] Django REST Framework configurado.
- [x] Dependências do back-end fixadas em `requirements.txt`.
- [x] Autenticação JWT incluída nas dependências e no back-end.
- [x] Configuração de CORS incluída.
- [x] Geração de schema OpenAPI com `drf-spectacular`.
- [x] Front-end inicializado com Next.js, React e TypeScript.
- [x] Script de preparação do ambiente (`tools/setup_dev.sh`).
- [x] Gate de validação da fundação (`tools/validar_fundacao.sh`).
- [x] Verificação de schema do banco (`tools/checar_schema.py`).
- [~] Processo reprodutível de migrations: os scripts fazem verificações, mas a documentação de `tools/README.md` contém orientações contraditórias sobre gerar e versionar migrations.
- [ ] Documentar variáveis de ambiente e configuração de desenvolvimento em um `.env.example`.
- [ ] Definir e documentar banco de dados para implantação.
- [ ] Documentar estratégia de deploy e configuração de produção.

## 2. Usuários, autenticação e autorização

- [x] Modelo de usuário customizado no back-end.
- [x] Modelo de estudante (`Student`) no domínio de usuários.
- [x] Dependências e configuração para autenticação JWT.
- [~] Fluxo de login no front-end: existe estrutura inicial, mas o fluxo completo com persistência segura de sessão e integração de permissões precisa ser validado.
- [~] Separação de permissões por perfil (professor/estudante): há módulo de permissões; falta comprovar todos os casos de uso e restrições dos requisitos por meio de testes.
- [ ] Validar que somente professores possam administrar jornadas, etapas, chefes, perguntas e grupos.
- [ ] Validar o acesso dos estudantes apenas aos recursos permitidos para seu grupo.
- [ ] Implementar e validar recuperação/alteração de credenciais, caso permaneça no escopo funcional.
- [ ] Criar testes de autenticação, autorização e acesso negado para cada perfil.

## 3. Turmas, grupos e estudantes

- [x] Modelo `Group`.
- [x] Relacionamento entre estudantes e grupos.
- [x] Campo de pontuação do grupo e operação de adição de pontos no domínio.
- [x] Views/serialização para operações de gerenciamento de grupos identificadas no back-end.
- [~] Cadastro e gerenciamento de estudantes: o modelo e o relacionamento existem; confirmar o fluxo completo de criação em lote e edição conforme os requisitos.
- [ ] Garantir validação de dados e mensagens de erro amigáveis nos formulários.
- [ ] Implementar a experiência de gerenciamento de turmas e grupos no front-end.
- [ ] Implementar visualização de estudantes, pontuação e informações individuais no front-end.
- [ ] Testar isolamento de dados entre grupos e turmas.

## 4. Heróis

- [x] Modelo `Hero`.
- [x] Associação de herói a grupo e jornada.
- [x] Estado de ativação do herói.
- [x] O motor de batalha consulta o herói ativo do grupo na jornada.
- [~] Regra de herói ativo único: o motor utiliza o primeiro herói ativo encontrado; falta garantir a unicidade por restrição/validação e cobrir concorrência.
- [ ] Implementar telas de criação, edição, seleção e visualização de heróis.
- [ ] Validar atribuição de herói conforme as regras funcionais (por grupo, por jornada ou por estudante, conforme requisito final).
- [ ] Testar atributos, habilidades e progressão dos heróis.

## 5. Feitiços e regras de combate

- [x] Modelo `Spell`.
- [x] Tipos de feitiço e efeitos de combate implementados no domínio.
- [x] Abstração de combatente e operações de dano, cura e escudo.
- [x] Cálculo de recarga de feitiços (`spell_cooldown_left`).
- [x] Consulta de feitiços disponíveis (`available_spells`).
- [x] Aplicação de feitiços durante a rodada.
- [~] Cobertura automatizada das fórmulas e casos-limite: a implementação existe, mas a documentação de validação informa que a suíte Django está vazia.
- [ ] Criar testes para dano, cura, escudo, bônus, valores mínimos/máximos e recarga.
- [ ] Criar telas para consultar e selecionar feitiços.
- [ ] Exibir visualmente recargas e efeitos aplicados durante o combate.

## 6. Chefes, perguntas e alternativas

- [x] Modelo `Boss`.
- [x] Associação de feitiços a chefes.
- [x] Modelo de perguntas (`Question`).
- [x] Modelo de alternativas (`Choice`), incluindo indicação de alternativa correta.
- [x] Etapas podem definir um conjunto de chefes possíveis (`Stage.boss_pool`).
- [x] Motor filtra chefes ativos que possuem perguntas jogáveis.
- [x] Motor considera jogável uma pergunta com pelo menos duas alternativas e uma correta.
- [ ] Validar integralmente CRUDs e permissões para chefes, feitiços, perguntas e alternativas.
- [ ] Implementar telas administrativas para cadastrar e editar chefes e bancos de perguntas.
- [ ] Validar importação em lote de perguntas, se aplicável ao escopo.
- [ ] Criar testes para perguntas inválidas, sem alternativa correta ou com alternativas insuficientes.

## 7. Jornadas e etapas

- [x] Modelo `Journey`.
- [x] Modelo `Stage`.
- [x] Ordenação das etapas por jornada.
- [x] Restrição de unicidade da ordem de etapa dentro da jornada.
- [x] Pontuação máxima configurável por etapa.
- [x] Conjunto de chefes possíveis por etapa.
- [x] Modelo `GroupJourney` para acompanhar a execução por grupo.
- [x] Estados de execução (em andamento, concluída e falhou).
- [x] Registro de início e término.
- [x] Seleção da próxima etapa pendente em ordem.
- [ ] Validar CRUDs e permissões de jornadas e etapas de ponta a ponta.
- [ ] Implementar telas de criação e organização de jornadas.
- [ ] Implementar tela de acompanhamento da progressão dos grupos.
- [ ] Definir e testar comportamento para reinício, abandono ou retomada de jornada.

## 8. Motor de batalha

- [x] Função `start_stage()` para iniciar uma etapa.
- [x] Validação de jornada em andamento e grupo ativo.
- [x] Bloqueio de início quando já existe batalha em andamento.
- [x] Verificação da existência de herói ativo.
- [x] Sorteio de chefe a partir do conjunto da etapa.
- [x] Sorteio de perguntas ainda não utilizadas, com reutilização quando necessário.
- [x] Função `answer()` para resolver uma rodada.
- [x] Validação de alternativa pertencente à pergunta atual.
- [x] Validação de pertencimento do estudante ao grupo.
- [x] Aplicação de pontos e dano quando a resposta está correta.
- [x] Execução da ação do chefe enquanto ele estiver vivo.
- [x] Encerramento por vitória, derrota ou limite de 50 turnos.
- [x] Atualização de estado e pontuação ao encerrar a etapa.
- [x] Atualização da progressão da jornada.
- [x] Transações e bloqueios de linha nas operações centrais.
- [ ] Criar testes unitários determinísticos para o motor, injetando RNG controlado.
- [ ] Criar testes de concorrência e chamadas simultâneas.
- [ ] Validar todos os cenários de falha e transições de estado.
- [ ] Integrar e testar o fluxo completo via API e interface.

## 9. Histórico, pontuação e desempenho

- [x] Modelo `BattleEvent` para registrar eventos da batalha.
- [x] Registro de turno, ator, estudante, pergunta, resposta, feitiço e valor aplicado.
- [x] Cálculo de pontuação total da jornada do grupo.
- [x] Resumo por etapa.
- [x] Resumo individual de questões respondidas, acertos e pontos.
- [x] Cálculo de nota sugerida em escala de 0 a 10.
- [ ] Validar se a nota sugerida corresponde exatamente à regra pedagógica definida nos requisitos.
- [ ] Expor relatórios e resumo por endpoints documentados.
- [ ] Criar painéis de desempenho para professores.
- [ ] Criar visualização de pontuação e progresso para estudantes.
- [ ] Definir política de correção manual e histórico de alterações de notas.

## 10. Front-end e integração

- [x] Aplicação Next.js inicializada.
- [x] React e TypeScript configurados.
- [x] Axios disponível para comunicação HTTP.
- [~] Estrutura inicial de páginas/componentes.
- [ ] Consolidar cliente HTTP e URL-base da API.
- [ ] Implementar autenticação e controle de sessão.
- [ ] Implementar navegação conforme perfil do usuário.
- [ ] Implementar telas de turmas, grupos e estudantes.
- [ ] Implementar telas de heróis e seleção de herói.
- [ ] Implementar telas de jornadas e etapas.
- [ ] Implementar telas de chefes, perguntas e alternativas.
- [ ] Implementar interface de batalha com turnos, perguntas, vida, escudo e feitiços.
- [ ] Implementar histórico de eventos e resultados.
- [ ] Implementar relatórios e painel do professor.
- [ ] Implementar estados de carregamento, erro, vazio e confirmação.
- [ ] Garantir responsividade e acessibilidade.
- [ ] Validar lint e build no CI.

## 11. Qualidade, testes e CI

- [x] Gate de fundação.
- [x] Gate de CRUD com verificações HTTP de fumaça.
- [x] Verificações de configuração e schema.
- [x] Workflow de CI para o back-end identificado no repositório.
- [!] `tools/README.md` menciona uma suíte de 50+ casos na descrição do gate de CRUD, mas também informa que a suíte Django está atualmente vazia. Atualizar a documentação após conferir os scripts e os testes realmente executados.
- [ ] Criar testes unitários para modelos, serializers, permissões e regras de negócio.
- [ ] Criar testes de integração para endpoints.
- [ ] Criar testes de ponta a ponta dos fluxos principais.
- [ ] Adicionar lint e build do front-end ao CI.
- [ ] Definir cobertura mínima e critérios de aprovação.
- [ ] Adicionar validação de segurança e dependências antes de produção.

## 12. Marcos de desenvolvimento

Os marcos abaixo organizam o trabalho por entregas verificáveis. Eles não substituem as datas do planejamento original; servem como sequência de conclusão técnica.

- [x] **Marco 0 — Fundação:** ambiente, dependências, configuração do Django, schema e scripts de validação.
- [~] **Marco 1 — CRUDs e domínio:** principais modelos e operações do back-end existem; falta consolidar testes e validar todos os fluxos e permissões.
- [~] **Marco 2 — Motor de regras:** motor de batalha implementado; falta cobertura automatizada abrangente.
- [ ] **Marco 3 — API integrada:** todos os fluxos do jogo expostos, documentados e testados via HTTP.
- [ ] **Marco 4 — Front-end funcional:** interface conectada à API com os fluxos de professor e estudante.
- [ ] **Marco 5 — Validação ponta a ponta:** jornada completa executável, relatórios conferidos e regressões cobertas.
- [ ] **Marco 6 — Preparação para entrega:** documentação final, deploy, configuração de produção e validação com usuários.

---

## Pendências de documentação e consistência

Antes de considerar o projeto pronto para uma entrega, resolver estes pontos:

1. **Migrations:** `tools/README.md` descreve a geração local de migrations como parte do setup, mas também descreve um gate que verifica se elas não estão sendo ignoradas pelo Git. Definir uma única política: migrations versionadas (recomendado para colaboração) ou geradas em cada ambiente; ajustar scripts e documentação para refletir essa decisão.
2. **Testes:** a descrição da tabela de `validar_crud.sh` menciona 50+ casos, enquanto a seção de checks afirma que `manage.py test` está vazio. Conferir o script e o diretório de testes e corrigir a contagem/descrição.
3. **Permissões:** documentar a matriz professor × estudante × grupo e criar testes negativos para garantir que um usuário não acesse dados de outro grupo.
4. **Front-end:** diferenciar páginas de demonstração/estrutura inicial de fluxos efetivamente conectados à API.
5. **Regras pedagógicas:** confirmar com os requisitos se nota sugerida, pontos de grupo, pontos individuais e atribuição de herói correspondem à regra final esperada.

## Critério para concluir uma funcionalidade

Marque uma tarefa como `[x]` somente quando:

1. A regra ou tela estiver implementada.
2. A API e as permissões relacionadas estiverem funcionando, quando aplicável.
3. Houver testes para o comportamento normal e os principais casos de erro.
4. A documentação correspondente estiver atualizada.
5. O fluxo não depender de uma etapa manual não documentada.

Atualize este arquivo no mesmo pull request em que a funcionalidade for concluída.
