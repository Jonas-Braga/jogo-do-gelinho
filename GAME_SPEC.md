\# Projeto: remake moderno de Frostbite (Atari 2600, Activision 1983) em HTML5



\## Objetivo

Recriar a jogabilidade do Frostbite original como um jogo web jogável no navegador,

com visual moderno, polido e semi-realista. A mecânica deve ser fiel ao original;

o visual deve ser totalmente novo.



\## Referência visual

\- A pasta do projeto contém a imagem de referência `frostbite1.jpeg`.

&#x20; Analise-a antes de começar e use-a como base para o design do \*\*personagem

&#x20; principal\*\* (o esquimó) e do \*\*urso polar/pardo\*\*: proporções, paleta, roupas

&#x20; e estilo.

\- Todos os outros elementos (placas de gelo, água, iglu, peixes, animais

&#x20; marinhos, céu, cenário) devem seguir a mesma linguagem visual da referência

&#x20; para manter a consistência.



\## Mecânica (fiel ao original)

\- \*\*Tela:\*\* costa nevada no topo, onde o iglu é construído. Abaixo, 4 fileiras

&#x20; de placas de gelo se movem horizontalmente na água, alternando a direção

&#x20; entre as fileiras e reaparecendo do lado oposto ao sair da tela.

\- \*\*Movimento:\*\* o jogador pula para cima e para baixo entre a costa e as

&#x20; fileiras, e anda para a esquerda e para a direita sobre a placa ou a costa.

&#x20; Se cair na água, perde uma vida.

\- \*\*Construção do iglu:\*\* pular em uma fileira de placas brancas faz elas

&#x20; ficarem azuis e adiciona 1 bloco ao iglu. Quando as 4 fileiras ficam azuis,

&#x20; elas voltam a ser brancas. São 15 blocos mais a porta. Com o iglu completo,

&#x20; o jogador volta à costa e entra nele para concluir a fase.

\- \*\*Temperatura:\*\* contador regressivo começando em 45°. Se chegar a 0, o

&#x20; personagem congela e perde uma vida. Graus restantes viram pontos bônus ao

&#x20; entrar no iglu.

\- \*\*Inverter a direção:\*\* uma tecla inverte a direção da fileira em que o

&#x20; jogador está, ao custo de 1 bloco do iglu (só funciona se houver algum bloco).

\- \*\*Inimigos na água:\*\* gansos, caranguejos e moluscos se movem sobre as

&#x20; fileiras e empurram o jogador para fora da placa.

\- \*\*Peixes:\*\* nadam entre as fileiras e dão pontos bônus quando coletados.

\- \*\*Urso:\*\* a partir da fase 4, um urso patrulha a costa. O contato com ele

&#x20; custa uma vida.

\- \*\*Poderes (acréscimo ao original):\*\* só nas fases normais, a partir da fase 6;

&#x20; fases especiais não têm. Cada item passa uma única vez por fase e é pego como

&#x20; os peixes. \*\*Boia de patinho\*\* (fase 6 em diante): por 5 s, cair na água não

&#x20; custa a vida; ele boia, nada devagar e pula de volta para o gelo ou para a

&#x20; costa; se o tempo acabar com ele na água, afunda. \*\*Chuteira dourada\*\* (fase

&#x20; 11 em diante, além da boia): por 5 s fica imune; o bicho que encosta leva um

&#x20; chute, voa longe e vale 50 × fase; o urso é jogado para longe e fica tonto 2 s.

\- \*\*Progressão:\*\* a velocidade aumenta a cada fase. Em fases alternadas, as

&#x20; placas são fragmentadas (vários pedaços pequenos em vez de blocos inteiros)

&#x20; e se abrem e se fecham periodicamente.

\- \*\*Pontuação e vidas:\*\* pontos por placa ativada, por peixe e por bônus de

&#x20; temperatura. Vida extra a cada 5.000 pontos. Começa com 3 vidas.



\## Direção visual (moderna e semi-realista)

\- \*\*Água:\*\* animada, com reflexos, ondulação e profundidade (gradiente mais

&#x20; escuro para baixo). Respingos quando algo cai.

\- \*\*Placas de gelo:\*\* textura de gelo com bordas irregulares, leve

&#x20; translucidez, sombra na água e um balanço sutil. O estado "ativado" deve ser

&#x20; claramente distinguível, por exemplo com um brilho azulado.

\- \*\*Iglu:\*\* construído bloco a bloco com animação de encaixe e textura de neve

&#x20; compactada.

\- \*\*Cenário:\*\* céu com gradiente que muda conforme a temperatura cai (do dia

&#x20; ao entardecer), neve caindo com partículas e aurora boreal opcional em fases

&#x20; avançadas.

\- \*\*Personagens:\*\* animações de idle, corrida, pulo, queda na água,

&#x20; congelamento e entrada no iglu. O personagem deve tremer quando a

&#x20; temperatura estiver baixa.

\- \*\*Feedback:\*\* partículas, screen shake leve ao perder vida e números

&#x20; flutuantes de pontuação.

\- \*\*HUD:\*\* limpo e moderno, com pontuação, vidas, fase e um termômetro visual

&#x20; para a temperatura.



\## Stack e requisitos técnicos

\- HTML5 + Canvas 2D + JavaScript puro (ES modules), sem frameworks. Pode usar

&#x20; Vite como servidor de desenvolvimento, se ajudar.

\- Game loop com `requestAnimationFrame` e delta time, independente de FPS.

\- Resolução lógica fixa (ex: 1280x720) com escala responsiva e proporção

&#x20; mantida.

\- Assets: gere sprites e texturas proceduralmente via Canvas/SVG, ou como

&#x20; arquivos SVG/PNG na pasta `assets/`. Nada de imagens externas da internet.

\- Controles: setas ou WASD para mover, Espaço para inverter a placa, P para

&#x20; pausar. Suporte opcional a toque no mobile.

\- Áudio com Web Audio API (efeitos sintetizados: pulo, coleta, splash, bloco

&#x20; do iglu), com botão de mudo.

\- Recorde salvo em `localStorage`.

\- Estrutura organizada: `src/` com módulos separados (game loop, player,

&#x20; floes, enemies, igloo, renderer, input, audio, hud, levels).



\## Telas

Tela inicial com título e instruções, jogo, pausa, fim de fase com contagem

de bônus, e game over com pontuação e recorde.



\## Forma de trabalho

1\. Primeiro, analise a imagem de referência e me apresente um plano: estrutura

&#x20;  de arquivos, paleta de cores extraída da referência e ordem de

&#x20;  implementação. Aguarde minha aprovação.

2\. Implemente em etapas jogáveis, testando ao final de cada uma:

&#x20;  - Etapa 1: game loop, água, placas se movendo e o personagem pulando

&#x20;    (placeholders visuais OK)

&#x20;  - Etapa 2: iglu, temperatura, vidas, pontuação e conclusão da fase

&#x20;  - Etapa 3: inimigos, peixes, urso e progressão de fases

&#x20;  - Etapa 4: arte final, animações, partículas e áudio

&#x20;  - Etapa 5: telas, polimento e ajuste de dificuldade

3\. Ao final de cada etapa, resuma o que foi feito e como testar.

