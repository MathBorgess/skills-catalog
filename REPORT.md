# Relatório de Execução e Evolução da Skill `explain-me`

Este documento registra a reformulação arquitetural, a execução prática e a auto-explicação audiovisual da skill [`explain-me`](skills/explain-me/SKILL.md), bem como as dificuldades enfrentadas pelo agente, uma seção aberta para críticas do mantenedor e o roadmap para futuras iterações.

---

## 1. Visão Geral e Cronologia do Processo

A jornada de modernização do repositório [`skills-catalog`](README.md) concentrou-se em elevar a precisão de comunicação dos agentes para um patamar determinístico, inspecionável e visualmente rigoroso.

```
Domain Modeling (GLOSSARY.md)
   │
   ├─► Depreciação de handoff / shunt (deprecated/)
   ├─► Isolamento de still-cursor-living-day (Experiments)
   │
   └─► Redesenho da skill explain-me
         │
         ├─► STE-lite (80% ASD-STE100) & ste-lint.mjs
         ├─► Padrão HTML Autônomo (Zero Build Step)
         ├─► Pipeline 3b1b Motion + Kokoro ONNX Audio
         │
         └─► Auto-Execução: Vídeo 1080p 30 FPS Time-Locked
```

### Fase 1: Domain Modeling e Glossário Canônico
* **Ação**: Importação do padrão de modelagem de domínio de Matt Pocock, criando a skill [`skills/domain-modeling/`](skills/domain-modeling/SKILL.md) e o arquivo canônico [`GLOSSARY.md`](GLOSSARY.md).
* **Impacto**: Fixação formal de vocabulário inequívoco para termos como *Catalog*, *Skill*, *Operator*, *Experiment*, *Scorer*, *STE-lite*, *Interactive Explainer*, *3b1b Style*, *Kokoro Narration* e *Explain-Back*.

### Fase 2: Depreciação Limpa de `handoff` e `shunt`
* **Ação**: Remoção das skills do fluxo produtivo ativo, movendo-as para `deprecated/handoff` e `deprecated/shunt`.
* **Impacto**: Atualização do catálogo [`README.md`](README.md), do manifesto de plugins `.claude-plugin/plugin.json`, remoção dos hooks associados em `hooks/hooks.json`, adaptação dos testes automatizados e limpeza de symlinks locais.

### Fase 3: Governança de Experimentos
* **Ação**: Reclassificação da skill [`skills/still-cursor-living-day/`](skills/still-cursor-living-day/SKILL.md) como **Experiment** no [`README.md`](README.md), diferenciando-a dos *Operators* genéricos por responder a uma pergunta empírica com métricas rastreáveis.

### Fase 4: Reengenharia da Skill `explain-me`
Inspirada nos princípios de modelos mentais de Andrej Karpathy e no padrão de redação técnica aeroespacial ASD-STE100:
1. **Intake Grill de 2 Perguntas**: Alinhamento rápido de formato e profundidade sem fricção burocrática.
2. **Isolamento do Ponto de Apoio (*Load-Bearing Distinction*)**: Obrigação de ancorar cada explicação na dobradiça invariante do sistema e em um único exemplo contínuo.
3. **STE-lite (80% ASD-STE100)**: Normatização em [`references/ste-lite.md`](skills/explain-me/references/ste-lite.md) (frases descritivas ≤ 25 palavras, procedurais ≤ 20 palavras, parágrafos ≤ 6 frases, voz ativa mandatória, proibição de alternância de sinônimos).
4. **Linter Automatizado**: Desenvolvimento do utilitário Node [`scripts/ste-lint.mjs`](skills/explain-me/scripts/ste-lint.mjs) e testes unitários em [`scripts/ste-lint.test.mjs`](skills/explain-me/scripts/ste-lint.test.mjs), integrados à rotina obrigatória `npm run check`.
5. **Arquitetura HTML Interativa**: Documentada em [`references/interactive-html.md`](skills/explain-me/references/interactive-html.md), exigindo arquivos autônomos únicos (inlining total de CSS/SVG/JS, responsividade via CSS grid/clamp, controles por toque e zero etapa de compilação/npm).
6. **Pipeline de Vídeo Motion Graphics (Estilo 3b1b)**: Formalizado em [`references/video-motion.md`](skills/explain-me/references/video-motion.md), estipulando a sincronização temporal mandatória (*time-locking*) entre narração neural via Kokoro ONNX local e a duração visual dos frames.

### Fase 5: Execução Prática — A Auto-Explicação em Vídeo
A skill `explain-me` foi instanciada para se auto-explicar em formato de vídeo:
1. **Roteiro STE-lite**: Dividido em 4 cenas auditadas pelo linter:
   * *Cena 1*: Missão & Compreensão Ativa.
   * *Cena 2*: Ponto de Apoio (*Load-Bearing Distinction*) & Motor de Regras STE-lite.
   * *Cena 3*: Escolha da Representação & Arquitetura HTML Autônoma.
   * *Cena 4*: Sincronização Audiovisual 1:1 e Porta Diagnóstica Explain-Back.
2. **Síntese Neural de Áudio**: Executada localmente via Kokoro ONNX (`af_bella`, 24kHz), medindo exatamente as durações das cenas.
3. **Renderização dos Frames (1080p @ 30 FPS)**: 1106 frames desenhados na paleta Slate 900 (`#0f172a`) com grid matemático, órbitas vetoriais, osciladores dinâmicos e calibração de contraste.
4. **Multiplexação & Subtítulos**: Geração do arquivo `explain-me-auto.mp4` e legendas com timestamps exatos em `explain-me-auto.srt`.

---

## 2. Pontos de Dificuldade e Atrito Enfrentados pelo Agente

Durante a concepção e implementação, o agente encontrou desafios técnicos e heurísticos específicos:

### A. Bootstrapping de Runtime Neural em Ambiente Local
* **Dificuldade**: O ambiente operacional do sistema não possuía o pacote `kokoro-onnx` nem o `pillow` instalados globalmente, e tentar invocar comandos em ambientes virtuais inexistentes ou binários de terceiros gerava falhas `code 127` (ex.: `.venv/bin/pip` ausente).
* **Solução Adotada**: Uso do gerenciador ultrarrápido `uv` para isolar as dependências em `.venv/` (`uv pip install --python .venv/bin/python3 kokoro-onnx soundfile pillow`), baixando os pesos ONNX (`kokoro-v0_19.onnx` ~325MB e `voices.bin` ~5.7MB) com validação imediata via script efêmero de verificação.

### B. Calibração de Acessibilidade Visual e Contraste
* **Dificuldade**: Na primeira passagem de renderização gráfica, alguns componentes (como o card "3. Interactive HTML" e botões de status) utilizaram sobreposição de cores de mesma matriz (texto ciano em fundo ciano com alpha alto, ou verde sobre verde), resultando em contraste inferior a 4.5:1.
* **Solução Adotada**: O agente utilizou a ferramenta de inspeção de arquivos (`view_file`) nos snapshots reais extraídos pelo ffmpeg (`thumb_scene1.png`, `thumb_scene2.png`, `thumb_scene3.png`), detectou as deficiências de legibilidade e reescreveu o motor de desenho (`render_video_polished.py`) para utilizar cartões em slate escuro com contornos neon nítidos e tipografia clara em `#f8fafc`.

### C. Rigor Sintático do STE-lite vs. Densidade Conceitual
* **Dificuldade**: Expressar tópicos de engenharia de software e arquitetura de inteligência artificial mantendo rigorosamente a regra de ≤ 25 palavras por frase descritiva e voz ativa sem recorrer a jargões vagos exigiu múltiplas rodadas de refinamento no script das cenas.
* **Solução Adotada**: A validação contínua através do script `ste-lint.mjs` serviu como barreira determinística, forçando o particionamento de ideias compostas em declarações atômicas e observáveis.

### D. Governança Rígida de Versionamento e Integridade do Repositório
* **Dificuldade**: As regras contratuais em `AGENTS.md` e a ação de CI em `scripts/check-version-bump.mjs` impedem push direto na branch `main` e invalidam commits com artefatos binários pesados não rastreados ou sem atualização de versão adequada quando modificada a pasta `skills/`.
* **Solução Adotada**: Toda a evolução foi mantida na branch dedicada `codex/explain-me-visual`, o `.gitignore` foi rigorosamente parametrizado para ignorar os binários gerados (`.venv`, `explain-me-auto.*`, `explain-me-scenes/`) e a suíte completa de testes (`npm run check`) foi executada com 100% de sucesso.

---

## 3. Seção Exclusiva para Críticas e Avaliação do Mantenedor

> **Espaço reservado para o usuário/mantenedor registrar suas impressões, ajustes de tom, críticas estéticas e feedbacks de usabilidade.**

```markdown
### Crítica do Mantenedor (Preencher com suas observações)

1. Estética e Ritmo do Vídeo:
   - [ ] O visual 3b1b (Slate-900, grids, neon) atingiu a sobriedade matemática desejada?
   - [ ] O ritmo de transição entre as 4 cenas (36,8s) parece adequado ou acelerado?
   - [ ] As animações vetoriais ajudam na compreensão ou distraem?

2. Narração e Voz Kokoro ONNX:
   - [ ] A voz `af_bella` soou natural para um vídeo técnico?
   - [ ] A velocidade da fala (1.0x) está confortável ou deve ser ajustada para 0.95x/1.05x?
   - [ ] A preferência futura inclui sintetizar narração em Português (pt-BR)?

3. Clareza do STE-lite:
   - [ ] O texto foi direto ao ponto ou soou excessivamente condensado?
   - [ ] O glossário em 3 partes foi suficiente para desmistificar os conceitos?

4. Comentários Livres:
   _Insira aqui seus apontamentos adicionais..._
```

---

## 4. Próxima Evolução da Skill (`explain-me` v2.0 Roadmap)

A partir das lições aprendidas neste ciclo, estão mapeadas as seguintes metas para as próximas versões:

### 1. Template Nativo Remotion / Motion Canvas
Substituir o script de frame-buffer Pillow por um template embutido de **Remotion** ou **Motion Canvas** em TypeScript, permitindo:
* Curvas de Bézier cúbicas avançadas e física de molas nativas (*spring physics*).
* Componentes vetoriais reutilizáveis e renderização acelerada por GPU.

### 2. Suporte Multi-Idioma e Persona Vocal no Kokoro
* Adicionar chave de configuração para seleção de idioma (`lang="pt-br"` ou `"en-us"`).
* Mapeamento de vozes alternativas no `voices.bin` para diferentes tons explicativos (formal, tutorial, documentário).

### 3. Explicador Híbrido: Vídeo + Playground Interativo Sincronizado
* Gerar um artefato web único contendo o vídeo `.mp4` ao lado de um canvas SVG interativo.
* Ao reproduzir o vídeo, os eventos de timestamp do `.srt` atualizam os nós do canvas em tempo real, permitindo ao usuário pausar a qualquer momento e manipular as variáveis com sliders.

### 4. Expansão Léxica do `ste-lint.mjs`
* Evoluir o linter de regras puramente métricas (tamanho de frases) para análise de vocabulário restrito, sinalizando palavras que não pertençam ao dicionário aprovado ASD-STE100 (ex.: identificar verbos polissêmicos ou termos passivos implícitos).
