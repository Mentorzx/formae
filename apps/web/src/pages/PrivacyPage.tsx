export function PrivacyPage() {
  return (
    <div className="page-grid">
      <section className="hero-card accent-panel">
        <p className="section-label">Privacidade local-first</p>
        <h2>Seus dados academicos devem continuar no seu dispositivo</h2>
        <p>
          O Formaê foi desenhado para importar, projetar e guardar o snapshot
          academico localmente. O site publico nao exige conta propria e o
          projeto evita backend com PII por padrao.
        </p>
        <p>
          Quando a extensao conversa com o SIGAA, o objetivo e somente permitir
          que o proprio usuario visualize progresso, grade, horarios, pendencias
          e contexto curricular dentro do Formaê.
        </p>
      </section>

      <section className="panel">
        <p className="section-label">Quais dados podem ser processados</p>
        <ul className="list">
          <li>
            Informacoes de autenticacao do SIGAA, como CPF ou usuario e senha,
            digitadas pelo proprio usuario na extensao.
          </li>
          <li>
            Informacoes de identificacao pessoal visiveis nas telas academicas,
            como nome, matricula e identificadores equivalentes emitidos pela
            UFBA.
          </li>
          <li>
            Conteudo do site SIGAA necessario para o fluxo academico suportado,
            incluindo turmas, notas, historico, horarios, componentes e
            metadados de documentos.
          </li>
          <li>
            Texto colado manualmente do SIGAA para gerar um snapshot local,
            quando o usuario opta pela importacao manual.
          </li>
          <li>
            Snapshot academico cifrado salvo no IndexedDB do proprio navegador.
          </li>
          <li>
            Catalogo publico da UFBA e do SIGAA sem dados pessoais, usado para
            contexto curricular.
          </li>
        </ul>
      </section>

      <section className="panel">
        <p className="section-label">Finalidade do tratamento local</p>
        <ul className="list">
          <li>
            Ler localmente o SIGAA para montar um snapshot academico do proprio
            usuario.
          </li>
          <li>
            Exibir progresso, pendencias, dependencias e planejamento academico
            dentro da PWA.
          </li>
          <li>
            Permitir importacao manual e sincronizacao automatica sem depender
            de um backend proprio com dados sensiveis.
          </li>
        </ul>
      </section>

      <section className="panel">
        <p className="section-label">O que o projeto nao faz por padrao</p>
        <ul className="list">
          <li>Nao envia senha do SIGAA para servidor do Formaê.</li>
          <li>Nao persiste credenciais do SIGAA em disco pelo runtime web.</li>
          <li>Nao mantem banco de dados remoto com historico academico.</li>
          <li>Nao ativa analytics por padrao.</li>
          <li>
            Nao vende nem transfere dados do usuario a terceiros por padrao.
          </li>
          <li>
            Nao usa os dados para publicidade, score, emprestimo ou finalidade
            sem relacao com o planejamento academico.
          </li>
        </ul>
      </section>

      <section className="panel">
        <p className="section-label">Retencao, armazenamento e controle</p>
        <p>
          O snapshot local pode ser apagado pelo proprio usuario na tela de
          importacao. Quando a passkey do vault esta ativa, leitura e escrita
          ficam bloqueadas ate um novo unlock local.
        </p>
        <p>
          As credenciais do SIGAA devem existir apenas em memoria durante a
          sessao efemera da extensao. O snapshot academico derivado fica no
          navegador do usuario, protegido por cofre local cifrado.
        </p>
        <p>
          A politica atual ainda depende das capacidades do navegador. Quando o
          browser entrega WebAuthn PRF, o cofre passa a preferir esse modo.
          Quando nao entrega, o app continua sendo transparente e cai para o
          modo local de wrap suportado.
        </p>
      </section>

      <section className="panel">
        <p className="section-label">Compartilhamento e terceiros</p>
        <p>
          O Formaê nao foi desenhado para encaminhar historico academico,
          credenciais do SIGAA ou snapshot privado para um servidor proprio. O
          unico host privado acessado pelo runtime e o proprio SIGAA da UFBA,
          por iniciativa do usuario.
        </p>
      </section>

      <section className="panel">
        <p className="section-label">
          Suporte, transparencia e revisao juridica
        </p>
        <p>
          Esta pagina descreve a intencao tecnica atual do projeto. Ela nao
          substitui revisao juridica, analise de LGPD nem documentacao formal de
          uma eventual publicacao em loja.
        </p>
        <p>
          O canal publico de suporte hoje e o proprio repositorio no GitHub.
        </p>
        <p>Repositorio: https://github.com/Mentorzx/formae</p>
      </section>
    </div>
  );
}
