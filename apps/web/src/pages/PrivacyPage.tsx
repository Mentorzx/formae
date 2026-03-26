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
      </section>

      <section className="panel">
        <p className="section-label">O que o produto processa</p>
        <ul className="list">
          <li>
            Texto colado manualmente do SIGAA para gerar um snapshot local.
          </li>
          <li>
            Views autenticadas do SIGAA lidas pela extensao no navegador do
            usuario.
          </li>
          <li>
            Snapshot academico cifrado salvo no IndexedDB do proprio browser.
          </li>
          <li>
            Catalogo publico da UFBA e do SIGAA sem dados pessoais.
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
        </ul>
      </section>

      <section className="panel">
        <p className="section-label">Retencao e controle local</p>
        <p>
          O snapshot local pode ser apagado pelo proprio usuario na tela de
          importacao. Quando a passkey do vault esta ativa, leitura e escrita
          ficam bloqueadas ate um novo unlock local.
        </p>
        <p>
          A politica atual ainda depende das capacidades do navegador. Quando o
          browser entrega WebAuthn PRF, o cofre passa a preferir esse modo.
          Quando nao entrega, o app continua sendo transparente e cai para o
          modo local de wrap suportado.
        </p>
      </section>

      <section className="panel">
        <p className="section-label">Suporte e revisao juridica</p>
        <p>
          Esta pagina descreve a intencao tecnica atual do projeto. Ela nao
          substitui revisao juridica, analise de LGPD nem documentacao formal de
          uma eventual publicacao em loja.
        </p>
        <p>O canal publico de suporte hoje e o proprio repositorio no GitHub.</p>
      </section>
    </div>
  );
}
