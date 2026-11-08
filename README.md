# Jogo do Gelinho

Jogo de plataforma no gelo para o navegador, feito em HTML5 Canvas e JavaScript puro.
Pule entre placas de gelo flutuantes para construir seu iglu antes que a temperatura chegue a zero.

## Como jogar

- Pule nas placas brancas: cada fileira que acende vira um bloco do iglu.
- Complete os 15 blocos + a porta, volte para a costa e entre no iglu antes de congelar.
- Fuja dos gansos, caranguejos, moluscos e, a partir da fase 4, do urso. Peixes valem pontos!
- Os graus que sobrarem no termômetro viram bônus. Vida extra a cada 5.000 pontos.

| Tecla | Ação |
|---|---|
| ← → (ou A D) | andar |
| ↑ ↓ (ou W S) | pular entre a costa e as placas |
| Espaço | inverter a direção da placa (custa 1 bloco do iglu) |
| ↑ em frente à porta | entrar no iglu pronto |
| P | pausar |
| M | ligar/desligar o som |

No celular, aparecem botões de toque na tela.

## Rodar localmente

Não há build nem dependências. Precisa de um servidor estático (ES modules não rodam via `file://`):

```bash
npm start          # = python tools/serve.py 8137  (servidor sem cache)
```

Depois abra http://localhost:8137.

## Testes

```bash
npm test           # suíte completa no Node
```

A mesma suíte roda no navegador em http://localhost:8137/tests/.
Testes novos entram como "progressivos" e, depois de aprovados, viram "regressivos"
(`npm run test:baseline`); a suíte falha se algum teste regressivo sumir.

## Estrutura

```
index.html, style.css   página do jogo
src/                    módulos do jogo (loop, jogador, placas, inimigos, urso, iglu,
                        renderização, sprites procedurais, partículas, áudio, HUD, telas)
tests/                  testes (Node e navegador)
tools/serve.py          servidor de desenvolvimento sem cache
```

Toda a arte é desenhada por código (Canvas 2D) e todos os sons são sintetizados com a
Web Audio API: não há imagens nem áudio externos.
