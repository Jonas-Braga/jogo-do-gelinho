# Projeto

Jogo do Gelinho: jogo original em HTML5 Canvas com a mecânica de Frostbite (Atari 2600). A especificação completa está em GAME_SPEC.md; consulte-a antes de implementar qualquer funcionalidade.

A imagem de referência é `frostbite1.jpeg` (arte da caixa original). Use-a só como referência de clima e paleta; não copie o nome, o logo nem o design dos personagens. Personagens e visual são originais.

# Convenções

- JavaScript puro com ES modules, código em src/
- Rodar com `npm start` (= `python tools/serve.py 8137`, servidor SEM cache) e abrir http://localhost:8137. Não use `python -m http.server`: o navegador mistura módulos antigos e novos do cache depois de uma atualização
- Resolução lógica 1280x720 (src/config.js); simulação em passo fixo de 1/120 s
- `window.__game` fica exposto para depuração no console
- Ao terminar uma etapa, atualize a seção "Progresso" abaixo

# Testes (obrigatório a cada etapa ou nova versão)

- `npm test` roda tudo no Node; `http://localhost:8137/tests/` roda a mesma suíte no navegador com canvas real
- `tests/specs/contract.test.js`: regras da GAME_SPEC (45°, 3 vidas, 16 peças, controles...). Só mude com aprovação do usuário
- `tests/specs/etapaN.test.js`: um arquivo por etapa; `futuras.test.js` tem os itens pendentes (`test.todo`) das etapas seguintes
- **Progressivo** = teste novo, ainda fora de `tests/baseline.json`. **Regressivo** = está na baseline
- Toda funcionalidade nova ganha testes; ao implementar um `test.todo`, transforme-o em teste real
- Nunca apague, renomeie ou enfraqueça testes da baseline: a suíte falha se algum sumir. Se uma mudança de regra exigir, peça aprovação antes
- Só rode `npm run test:baseline` (promove progressivos a regressivos) depois que o usuário aprovar a etapa
- Antes de entregar uma etapa: `npm test` com 0 falhas e 0 testes sumidos
- `localStorage` só via `src/storage.js` (prefixo `gelinho.`); `tests/env.js` troca o prefixo para `gelinho.test.` para a suíte no navegador não sobrescrever recorde/mudo do jogador
- `new Game(canvas)` começa direto numa partida (testes); o jogo real usa `new Game(canvas, { title: true })` (tela inicial)

# Progresso

- [x] Etapa 1: loop com delta time e passo fixo, escala responsiva, água animada, 4 fileiras com direção alternada e wrap, personagem andando e pulando, queda na água com respingo e respawn, pausa (P, e automática ao perder o foco)
- [x] Etapa 2: iglu (15 blocos + porta, com animação de encaixe), temperatura (45°, 1°/s, congelamento), 3 vidas + vida extra a cada 5.000, pontuação (10×fase por fileira, 10×fase por grau de bônus), inverter fileira com Espaço (−1 bloco), entrar no iglu → contagem do bônus → próxima fase, fim de jogo (Enter/Espaço reinicia). Arte procedural mais realista adiantada (src/sprites.js): placas com parte submersa e reflexo, personagem detalhado com tremor de frio, céu que entardece com a temperatura
- [x] Etapa 3: gansos/caranguejos/moluscos (ciclo por fase) e peixes (+200) andam SEMPRE contra a direção das placas da fileira (e viram junto quando a fileira é invertida); inimigos empurram o jogador. Urso: ao alcançar o jogador, ele dá um susto (braços erguidos, cara assustada, "!") e foge para longe do urso, que corre atrás rugindo; a vida só é perdida quando os dois saem da tela; urso na costa a partir da fase 4 (persegue o jogador na costa; invulnerabilidade de 1,5 s ao renascer), placas fragmentadas que abrem e fecham nas fases pares, velocidade crescente com teto. Suíte de testes criada. Áudio adiantado da etapa 4 (src/audio.js): 19 efeitos sintetizados com Web Audio, mudo com M ou botão no canto inferior direito, preferência salva em localStorage. Etapa 3 aprovada e promovida à baseline (93 regressivos)
- [x] Etapa 4: animações formais (`player.anim`: idle com respiração, run, jump com esticada, drown se debatendo, freeze, enter, scared, flee), partículas (lascas de gelo e neve ao pousar, brilhos ao acender fileira, bolhas ao afundar, vapor da respiração abaixo de 20°), placas afundam e balançam ao pousar com o jogador acompanhando, aurora boreal a partir da fase 5 (mais forte com a fase e com o céu escuro), som de passos. Entrada no iglu SEM fade: porta na FRENTE (pórtico de neve em arco, abertura do tamanho do personagem; o usuário rejeitou o túnel lateral por ser feio). Com o iglu completo e o jogador em frente à porta aparece a dica "↑ entrar"; ao apertar ↑ ele vira de costas (sprite próprio), se centraliza, entra (sobe 10 px e diminui 12% pela perspectiva, com a moldura do arco desenhada por cima) e uma cortina de pele desce fechando a porta; depois luz quente nas bordas da cortina e fumaça no topo. Entrar EXIGE ↑ (regra pedida pelo usuário; 5 testes regressivos ganharam o aperto de ↑ sem mudar nome nem verificações). Afundar SEM fade: mergulha e afunda acelerando até sumir por inteiro abaixo da linha d'água (mãos erguidas por último), com "glub", bolhas e anel. Etapa 4 aprovada e promovida à baseline (123 regressivos)
- [x] Etapa 5: tela inicial (src/screens.js: título de gelo, instruções, controles, recorde; cenário vivo com iglu aceso), recorde salvo em localStorage (ao concluir fase, no fim de jogo e ao esconder a aba) e mostrado no HUD, fim de jogo com pontuação × recorde e selo "NOVO RECORDE!", pausa com os controles, aviso de início de fase (o que há de novo), controles de toque (direcional, ⇄ inverter, II pausa; aparecem no primeiro toque; arrastar troca de direção; toque/clique começa na tela inicial), dificuldade ajustada (inimigos e urso nunca passam de 80% da velocidade de caminhada; fase 1 com grupos de 1 bicho). Etapa 5 aprovada. Projeto completo: 145 testes, todos regressivos na baseline; nenhum pendente. Mudanças futuras: testes novos entram como progressivos e só vão para a baseline após aprovação
