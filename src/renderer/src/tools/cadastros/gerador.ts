/**
 * Geração de pessoas e empresas fictícias para teste.
 *
 * Funções puras, sem React e sem rede: dá para exercitar tudo com o harness de
 * esbuild descrito em CONTRIBUTING §8.1.
 *
 * Os documentos saem de `documentos/validadores.ts`, então um CPF ou CNPJ
 * gerado aqui passa no validador da ferramenta Documentos — não há uma segunda
 * implementação do dígito verificador para divergir da primeira.
 *
 * **Nada disto corresponde a gente ou empresa real.** O endereço é plausível na
 * forma e tem CEP da faixa certa do estado, mas a combinação rua/número/CEP é
 * inventada: serve para preencher formulário e testar validação, não para
 * entregar nada no mundo.
 */

import { documentoPorTipo, type OpcoesGeracao } from '../documentos/validadores'

export type Sexo = 'feminino' | 'masculino'

export interface Endereco {
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  uf: string
  cep: string
}

export interface Pessoa {
  nome: string
  sexo: Sexo
  nascimento: string
  idade: number
  cpf: string
  rg: string
  pis: string
  cns: string
  email: string
  celular: string
  nomeDaMae: string
  endereco: Endereco
}

export interface Empresa {
  razaoSocial: string
  nomeFantasia: string
  cnpj: string
  abertura: string
  ramo: string
  email: string
  telefone: string
  endereco: Endereco
  responsavel: { nome: string; cpf: string }
}

// ---------------------------------------------------------------- sorteio

function sortear<T>(lista: readonly T[]): T {
  return lista[Math.floor(Math.random() * lista.length)]
}

function inteiro(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1))
}

function digitos(quantidade: number): string {
  return Array.from({ length: quantidade }, () => inteiro(0, 9)).join('')
}

/** Tira acento e espaço para montar e-mail a partir do nome. */
function semAcento(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLocaleLowerCase('pt-BR')
}

// -------------------------------------------------------------- vocabulário

const NOMES_FEMININOS = [
  'Ana', 'Beatriz', 'Camila', 'Carla', 'Daniela', 'Eduarda', 'Fernanda', 'Gabriela',
  'Helena', 'Isabela', 'Juliana', 'Larissa', 'Letícia', 'Luciana', 'Mariana', 'Natália',
  'Patrícia', 'Rafaela', 'Renata', 'Sabrina', 'Tatiane', 'Vanessa', 'Vitória', 'Yasmin',
  'Adriana', 'Bruna', 'Cristiane', 'Débora', 'Elaine', 'Flávia', 'Giovana', 'Jéssica'
] as const

const NOMES_MASCULINOS = [
  'André', 'Bruno', 'Caio', 'Carlos', 'Daniel', 'Eduardo', 'Felipe', 'Gabriel',
  'Gustavo', 'Henrique', 'Igor', 'João', 'Leonardo', 'Lucas', 'Marcelo', 'Marcos',
  'Matheus', 'Paulo', 'Rafael', 'Ricardo', 'Rodrigo', 'Thiago', 'Vinícius', 'Wagner',
  'Alexandre', 'Diego', 'Fernando', 'Guilherme', 'Jonathan', 'Murilo', 'Otávio', 'Sérgio'
] as const

const SOBRENOMES = [
  'Silva', 'Santos', 'Oliveira', 'Souza', 'Rodrigues', 'Ferreira', 'Alves', 'Pereira',
  'Lima', 'Gomes', 'Ribeiro', 'Carvalho', 'Almeida', 'Lopes', 'Soares', 'Fernandes',
  'Vieira', 'Barbosa', 'Rocha', 'Dias', 'Nascimento', 'Andrade', 'Moreira', 'Nunes',
  'Marques', 'Machado', 'Mendes', 'Freitas', 'Cardoso', 'Ramos', 'Gonçalves', 'Araújo',
  'Teixeira', 'Correia', 'Cavalcanti', 'Monteiro', 'Pinto', 'Moura', 'Castro', 'Campos'
] as const




const COMPLEMENTOS = ['', '', '', 'Apto 101', 'Apto 302', 'Casa 2', 'Bloco B', 'Sala 405', 'Fundos'] as const

const DOMINIOS = ['example.com', 'example.org', 'teste.com.br', 'exemplo.com.br'] as const

const RAMOS = [
  'Comércio de Alimentos', 'Serviços de Tecnologia', 'Transportes', 'Construções',
  'Consultoria Empresarial', 'Distribuidora de Materiais', 'Indústria Têxtil',
  'Logística', 'Engenharia', 'Serviços Contábeis', 'Comércio de Peças',
  'Agropecuária', 'Telecomunicações', 'Educação e Treinamento'
] as const

const SUFIXOS_EMPRESA = ['LTDA', 'LTDA', 'LTDA', 'ME', 'EIRELI', 'S.A.'] as const

/**
 * Endereços reais, colhidos da base pública de CEP.
 *
 * A primeira versão sorteava um CEP dentro da faixa do estado. A faixa estava
 * certa, mas o espaço de CEP é esparso: conferindo 33 valores contra a base,
 * **32 não existiam**. Num formulário que consulta o CEP — e muito sistema
 * brasileiro consulta — o cadastro gerado morria na primeira tela.
 *
 * Agora logradouro, bairro, cidade, UF e CEP vêm juntos e são verdadeiros. Só
 * o número da casa é sorteado, então o endereço resolve na consulta sem
 * apontar para a porta de ninguém.
 */
type EnderecoReal = readonly [uf: string, cidade: string, logradouro: string, bairro: string, cep: string]

const ENDERECOS: readonly EnderecoReal[] = [
  ['SP', 'São Paulo', 'Rua Brasil', 'Conjunto Habitacional Santa Etelvina III', '08485-432'],
  ['SP', 'São Paulo', 'Rua Brasil', 'Jardim da Conquista (Zona Oeste)', '05212-030'],
  ['SP', 'São Paulo', 'Viela Santos', 'Parque Taipas', '02987-172'],
  ['SP', 'São Paulo', 'Rua Santos Neto', 'Jardim Palmares (Zona Sul)', '04457-160'],
  ['SP', 'São Paulo', 'Rua Sete de Setembro', 'Jardim Novo Pantanal', '04472-000'],
  ['SP', 'São Paulo', 'Rua Sete de Setembro', 'Jardim Felicidade (Zona Norte)', '02326-190'],
  ['SP', 'Campinas', 'Praça Brasil', 'Jardim Nova Europa', '13040-129'],
  ['SP', 'Campinas', 'Rua João Brasil', 'Vila Formosa', '13045-060'],
  ['SP', 'Campinas', 'Rua Santos', 'Jardim Nova Europa', '13040-054'],
  ['SP', 'Campinas', 'Rua Santos Gendra', 'Jardim Vista Alegre', '13056-521'],
  ['SP', 'Campinas', 'Rua Sete de Setembro', 'Sousas', '13106-022'],
  ['SP', 'Campinas', 'Rua Sete de Setembro', 'Vila Industrial', '13035-350'],
  ['RJ', 'Rio de Janeiro', 'Rua Brasil', 'Penha', '21072-450'],
  ['RJ', 'Rio de Janeiro', 'Rua Brasil', 'Senador Camará', '21843-165'],
  ['RJ', 'Rio de Janeiro', 'Rua Santos', 'Santa Cruz', '23510-410'],
  ['RJ', 'Rio de Janeiro', 'Rua Santos', 'Santa Cruz', '23520-524'],
  ['RJ', 'Rio de Janeiro', 'Rua Sete de Setembro', 'Bonsucesso', '21044-210'],
  ['RJ', 'Rio de Janeiro', 'Rua Sete de Setembro', 'Curicica', '22711-311'],
  ['RJ', 'Niterói', 'Vila Brasil', 'Santana', '24110-003'],
  ['RJ', 'Niterói', 'Rua Brasília', 'Piratininga', '24350-010'],
  ['RJ', 'Niterói', 'Rua Santos Dumont', 'Icaraí', '24220-280'],
  ['RJ', 'Niterói', 'Rua Santos Moreira', 'Santa Rosa', '24241-080'],
  ['RJ', 'Niterói', 'Rua Rio Branco', 'Ponta D\'Areia', '24040-080'],
  ['RJ', 'Niterói', 'Praça Rio Branco', 'Jurujuba', '24370-256'],
  ['ES', 'Vitória', 'Rua Brasil 1', 'Resistência', '29032-585'],
  ['ES', 'Vitória', 'Avenida Brasil', 'Resistência', '29032-590'],
  ['ES', 'Vitória', 'Rua Santos Dumont', 'Maruípe', '29043-080'],
  ['ES', 'Vitória', 'Beco Nadir Santos', 'Forte São João', '29017-033'],
  ['ES', 'Vitória', 'Rua Sete de Setembro', 'Centro', '29015-000'],
  ['ES', 'Vitória', 'Praça Sete de Setembro', 'Centro', '29015-005'],
  ['MG', 'Belo Horizonte', 'Rua Brasil', 'Jardim Leblon', '31540-580'],
  ['MG', 'Belo Horizonte', 'Rua Brasil', 'Cardoso (Barreiro)', '30626-436'],
  ['MG', 'Belo Horizonte', 'Rua Santos', 'Bonsucesso (Barreiro)', '30622-730'],
  ['MG', 'Belo Horizonte', 'Rua Santos Souza', 'Santa Cruz', '31155-210'],
  ['MG', 'Belo Horizonte', 'Rua Sete de Setembro', 'Maria Teresa', '31873-160'],
  ['MG', 'Belo Horizonte', 'Rua Sete de Setembro', 'Cabana do Pai Tomás', '30512-070'],
  ['MG', 'Uberlândia', 'Rua Brasília', 'Bom Jesus', '38400-762'],
  ['MG', 'Uberlândia', 'Praça Brasil', 'Tibery', '38405-132'],
  ['MG', 'Uberlândia', 'Rua Biot Santos', 'Jardim Brasília', '38401-867'],
  ['MG', 'Uberlândia', 'Rua Euclides Santos', 'Jardim Brasília', '38401-362'],
  ['MG', 'Uberlândia', 'Rua Central', 'Nossa Senhora das Graças', '38402-152'],
  ['MG', 'Uberlândia', 'Avenida Central', 'Jardim Ipanema', '38406-202'],
  ['BA', 'Salvador', 'Rua Brasil', 'São Cristóvão', '41510-841'],
  ['BA', 'Salvador', 'Rua Brasil', 'Capelinha', '40393-070'],
  ['BA', 'Salvador', 'Vila Santos', 'Liberdade', '40343-805'],
  ['BA', 'Salvador', 'Avenida Santos', 'Santa Luzia', '40486-260'],
  ['BA', 'Salvador', 'Rua 7 de Setembro', 'Capelinha', '40393-540'],
  ['BA', 'Salvador', 'Rua 7 de Setembro', 'Nova Brasília', '41350-133'],
  ['SE', 'Aracaju', 'Rua Brasil', 'São Conrado', '49042-199'],
  ['SE', 'Aracaju', 'Rua Brasil', 'Marivan', '49039-095'],
  ['SE', 'Aracaju', 'Rua Ruth Santos', 'Industrial', '49065-680'],
  ['SE', 'Aracaju', 'Rua Romeu Santos', 'Salgado Filho', '49020-100'],
  ['SE', 'Aracaju', 'Rua Sete de Setembro', 'Aeroporto', '49037-849'],
  ['SE', 'Aracaju', 'Rua Sete de Setembro', 'Dezoito do Forte', '49072-700'],
  ['PE', 'Recife', 'Rua Brasil', 'Campo Grande', '52040-490'],
  ['PE', 'Recife', 'Rua Brasil', 'COHAB', '51270-410'],
  ['PE', 'Recife', 'Avenida Santos', 'COHAB', '51340-210'],
  ['PE', 'Recife', 'Travessa Santos', 'COHAB', '51340-211'],
  ['PE', 'Recife', 'Rua Sete de Setembro', 'Santo Amaro', '50110-783'],
  ['PE', 'Recife', 'Rua Sete de Setembro', 'Dois Irmãos', '52171-315'],
  ['AL', 'Maceió', 'Vila Brasil', 'Chã de Bebedouro', '57018-690'],
  ['AL', 'Maceió', 'Rua Brasília', 'Bebedouro', '57018-310'],
  ['AL', 'Maceió', 'Rua Oséas Santos', 'Petrópolis', '57062-505'],
  ['AL', 'Maceió', 'Rua Santos Dumont', 'Ponta Grossa', '57014-240'],
  ['AL', 'Maceió', 'Rua Sete de Setembro', 'Centro', '57020-700'],
  ['AL', 'Maceió', 'Rua Sete de Setembro', 'Tabuleiro do Martins', '57061-140'],
  ['PB', 'João Pessoa', 'Rua Brasília', 'Grotão', '58079-854'],
  ['PB', 'João Pessoa', 'Avenida BRASIL', 'Costa do Sol', '58048-418'],
  ['PB', 'João Pessoa', 'Rua Santos Dias', 'Ernani Sátiro', '58080-630'],
  ['PB', 'João Pessoa', 'Rua Santos Dumont', 'Cristo Redentor', '58071-170'],
  ['PB', 'João Pessoa', 'Rua Sete de Setembro', 'Oitizeiro', '58088-670'],
  ['PB', 'João Pessoa', 'Praça Barão do Rio Branco', 'Centro', '58010-760'],
  ['RN', 'Natal', 'Rua Brasília', 'Alecrim', '59030-060'],
  ['RN', 'Natal', 'Rua Brasília', 'Neópolis', '59080-380'],
  ['RN', 'Natal', 'Rua Santos', 'Lagoa Azul', '59139-750'],
  ['RN', 'Natal', 'Vila Santos', 'Quintas', '59035-375'],
  ['RN', 'Natal', 'Rua Sete de Setembro', 'Candelária', '59065-250'],
  ['RN', 'Natal', 'Praça Sete de Setembro', 'Cidade Alta', '59025-300'],
  ['CE', 'Fortaleza', 'Rua Brasília', 'Pici', '60442-710'],
  ['CE', 'Fortaleza', 'Praça Brasil', 'Panamericano', '60441-090'],
  ['CE', 'Fortaleza', 'Vila Santos', 'Fátima', '60040-180'],
  ['CE', 'Fortaleza', 'Vila Santos', 'Jardim Guanabara', '60346-374'],
  ['CE', 'Fortaleza', 'Rua 7 de Setembro', 'Parangaba', '60720-080'],
  ['CE', 'Fortaleza', 'Rua Sete de Setembro', 'João XXIII', '60525-640'],
  ['PI', 'Teresina', 'Rua Brasilar', 'Parque Juliana', '64035-820'],
  ['PI', 'Teresina', 'Rua Brasil Leste', 'Santa Lia', '64058-745'],
  ['PI', 'Teresina', 'Rua Mestre Santos', 'Tabajaras', '64067-560'],
  ['PI', 'Teresina', 'Rua Camilo Santos', 'Noivos', '64045-908'],
  ['PI', 'Teresina', 'Praça Rio Branco', 'Centro', '64000-140'],
  ['PI', 'Teresina', 'Rua Central', 'Redenção', '64016-865'],
  ['MA', 'São Luís', 'Rua Brasil', 'Bom Jesus', '65042-854'],
  ['MA', 'São Luís', 'Rua Brasil', 'Vila Vitória', '65059-864'],
  ['MA', 'São Luís', 'Rua Ana Santos', 'COHAB Anil III', '65050-170'],
  ['MA', 'São Luís', 'Alameda Santos', 'Planalto Turu', '65066-456'],
  ['MA', 'São Luís', 'Rua Sete de Setembro', 'Vila Palmeira', '65047-155'],
  ['MA', 'São Luís', 'Rua Sete de Setembro', 'Cidade Nova', '65083-370'],
  ['PA', 'Belém', 'Vila Brasil', 'Pedreira', '66080-085'],
  ['PA', 'Belém', 'Vila Brasil', 'Jurunas', '66030-245'],
  ['PA', 'Belém', 'Rua Santos', 'Pratinha (Icoaraci)', '66816-243'],
  ['PA', 'Belém', 'Vila Santos', 'Marambaia', '66615-135'],
  ['PA', 'Belém', 'Rua Sete de Setembro', 'Mangueirão', '66640-050'],
  ['PA', 'Belém', 'Alameda Sete de Setembro', 'Tapanã (Icoaraci)', '66825-800'],
  ['AP', 'Macapá', 'Avenida Brasil', 'Boné Azul', '68908-641'],
  ['AP', 'Macapá', 'Rua Brasil Novo', 'Brasil Novo', '68909-339'],
  ['AP', 'Macapá', 'Rua Oscar Santos', 'Santa Inês', '68901-410'],
  ['AP', 'Macapá', 'Rua Oscar Santos', 'Perpétuo Socorro', '68905-624'],
  ['AP', 'Macapá', 'Passagem Rio Branco', 'Central', '68900-760'],
  ['AP', 'Macapá', 'Praça Barão do Rio Branco', 'Central', '68900-453'],
  ['AM', 'Manaus', 'Rua Brasil', 'Educandos', '69070-360'],
  ['AM', 'Manaus', 'Rua Brasil', 'Morro da Liberdade', '69074-767'],
  ['AM', 'Manaus', 'Rua Santos Dias', 'Cidade Nova', '69095-168'],
  ['AM', 'Manaus', 'Rua Santos Dumont', 'Nossa Senhora das Graças', '69053-410'],
  ['AM', 'Manaus', 'Rua 7 de Setembro', 'Gilberto Mestrinho', '69006-430'],
  ['AM', 'Manaus', 'Rua 27 de Setembro', 'Cidade Nova', '69095-825'],
  ['RR', 'Boa Vista', 'Rua Brasília', 'Estados', '69305-640'],
  ['RR', 'Boa Vista', 'Avenida Brasil', 'Centenário', '69312-600'],
  ['RR', 'Boa Vista', 'Rua Santos Dumont', 'Aeroporto', '69310-127'],
  ['RR', 'Boa Vista', 'Rua Armênio Santos', 'Dr. Airton Rocha', '69318-764'],
  ['RR', 'Boa Vista', 'Rua 7 de Setembro', 'Cinturão Verde', '69312-379'],
  ['RR', 'Boa Vista', 'Rua 07 de Setembro', 'Alvorada', '69317-188'],
  ['AC', 'Rio Branco', 'Rua Brasil', 'Defesa Civil', '69921-866'],
  ['AC', 'Rio Branco', 'Rua Brasil', 'Calafate', '69914-364'],
  ['AC', 'Rio Branco', 'Rua dos Santos', 'Preventório', '69900-147'],
  ['AC', 'Rio Branco', 'Travessa Santos', 'Defesa Civil', '69921-839'],
  ['AC', 'Rio Branco', 'Rua 7 de Setembro', 'Raimundo Melo', '69921-038'],
  ['AC', 'Rio Branco', 'Rua 7 de Setembro', 'Alto Alegre', '69921-302'],
  ['DF', 'Brasília', 'Rua Brasília', 'Engenho das Lages (Gama)', '72492-245'],
  ['DF', 'Brasília', 'Avenida Brasil', 'Bora Manso', '71691-181'],
  ['DF', 'Brasília', 'Sítio Santos Dumont Rua 1', 'Setor Habitacional Jardim Botânico', '71680-391'],
  ['DF', 'Brasília', 'Sítio Santos Dumont Rua 4', 'Setor Habitacional Jardim Botânico', '71680-394'],
  ['DF', 'Brasília', 'Praça Central', 'Núcleo Bandeirante', '71705-500'],
  ['DF', 'Brasília', 'Praça Central', 'Incra 8 (Brazlândia)', '72760-168'],
  ['GO', 'Goiânia', 'Rua Brasil', 'Vila Vera Cruz', '74553-487'],
  ['GO', 'Goiânia', 'Rua Brasil', 'Residencial Portal do Oriente', '74357-125'],
  ['GO', 'Goiânia', 'Avenida Santos', 'Jardim Novo Mundo', '74715-450'],
  ['GO', 'Goiânia', 'Rua Santos Dumont', 'Jardim Guanabara', '74675-730'],
  ['GO', 'Goiânia', 'Rua 7 de Setembro', 'Setor Estrela Dalva', '74475-335'],
  ['GO', 'Goiânia', 'Rua 7 de Setembro', 'Parque Flamboyant', '74860-625'],
  ['RO', 'Porto Velho', 'Beco Brasília', 'Tucumanzal', '76804-486'],
  ['RO', 'Porto Velho', 'Rua Alto Brasil', 'Três Marias', '76812-666'],
  ['RO', 'Porto Velho', 'Beco Santos Dumont', 'Nova Floresta', '76806-760'],
  ['RO', 'Porto Velho', 'Rua Aristides Santos', 'Lagoinha', '76829-844'],
  ['RO', 'Porto Velho', 'Rua Vinte e Sete de Setembro', 'Flodoaldo Pontes Pinto', '76820-588'],
  ['RO', 'Porto Velho', 'Rua Rio Branco', 'Planalto', '76825-448'],
  ['TO', 'Palmas', 'Avenida Brasil', 'Distrito Industrial de Taquaralto', '77060-810'],
  ['TO', 'Palmas', 'Avenida Brasil', 'Loteamento Palmas Sul', '77062-330'],
  ['TO', 'Palmas', 'Rua Santos', 'Jardim Paulista (Taquaralto)', '77060-797'],
  ['TO', 'Palmas', 'Rua Lenice Santos', 'Setor Sônia Regina (Taquaralto)', '77060-656'],
  ['TO', 'Palmas', 'Rua Rio Branco', 'Jardim Aureny I', '77060-170'],
  ['TO', 'Palmas', 'Quadra ARNO 21 Alameda Central', 'Plano Diretor Norte', '77006-894'],
  ['MT', 'Cuiabá', 'Rua Brasil', 'Doutor Fábio Leite II', '78052-212'],
  ['MT', 'Cuiabá', 'Rua Brasil', 'Campo Velho', '78065-272'],
  ['MT', 'Cuiabá', 'Rua Santos Dumont', 'Altos da Serra I', '78052-320'],
  ['MT', 'Cuiabá', 'Rua Santos Dumont', 'Pico do Amor', '78065-105'],
  ['MT', 'Cuiabá', 'Rua Sete de Setembro', 'Altos da Serra I', '78052-348'],
  ['MT', 'Cuiabá', 'Rua Sete de Setembro', 'Centro-Norte', '78005-040'],
  ['MS', 'Campo Grande', 'Rua Brasília', 'Jardim Imá', '79102-050'],
  ['MS', 'Campo Grande', 'Praça Brasil', 'Coronel Antonino', '79010-710'],
  ['MS', 'Campo Grande', 'Rua Santos', 'Jardim São Bento', '79004-670'],
  ['MS', 'Campo Grande', 'Alameda Santos', 'Jardim Itatiaia', '79042-811'],
  ['MS', 'Campo Grande', 'Rua Rio Branco', 'Villagio Santa Inês', '79017-490'],
  ['MS', 'Campo Grande', 'Rua do Café Central', 'Vila Manoel Taveira', '79115-680'],
  ['PR', 'Curitiba', 'Rua Vital Brasil', 'Portão', '80320-120'],
  ['PR', 'Curitiba', 'Rua Assis Brasil', 'Barreirinha', '82220-150'],
  ['PR', 'Curitiba', 'Rua Acyr Santos', 'Vila Izabel', '80320-080'],
  ['PR', 'Curitiba', 'Rua Horacy Santos', 'Alto Boqueirão', '81770-342'],
  ['PR', 'Curitiba', 'Comunidade Urbana Sete de Setembro', 'Cidade Industrial', '81170-355'],
  ['PR', 'Curitiba', 'Comunidade Urbana Vila Ferrovila - 7 de Setembro - Santa Clara', 'Novo Mundo', '81050-255'],
  ['PR', 'Londrina', 'Rua Brasil', 'Centro', '86010-200'],
  ['PR', 'Londrina', 'Avenida Brasil', 'Maravilha', '86093-610'],
  ['PR', 'Londrina', 'Rua Santos', 'Lerroville', '86094-318'],
  ['PR', 'Londrina', 'Rua Antônio Santos', 'Jardim Santa Fé', '86035-740'],
  ['PR', 'Londrina', 'Rua 7 de Setembro', 'São Luiz', '86093-212'],
  ['PR', 'Londrina', 'Praça Sete de Setembro', 'Centro', '86010-430'],
  ['SC', 'Florianópolis', 'Servidão Brasil', 'Canasvieiras', '88054-634'],
  ['SC', 'Florianópolis', 'Servidão Brasiliano', 'Campeche', '88063-515'],
  ['SC', 'Florianópolis', 'Rua Santos', 'Vargem do Bom Jesus', '88056-603'],
  ['SC', 'Florianópolis', 'Rua Santos Reis', 'Barra da Lagoa', '88061-365'],
  ['SC', 'Florianópolis', 'Rua Sete de Setembro', 'Centro', '88010-060'],
  ['SC', 'Florianópolis', 'Servidão Cedro Central', 'Monte Cristo', '88090-519'],
  ['SC', 'Joinville', 'Rua Brasília', 'Nova Brasília', '89213-370'],
  ['SC', 'Joinville', 'Rua Vital Brasil', 'América', '89204-363'],
  ['SC', 'Joinville', 'Rua Santos', 'Bucarein', '89202-460'],
  ['SC', 'Joinville', 'Rua Raul dos Santos', 'Jarivatuba', '89230-080'],
  ['SC', 'Joinville', 'Rua Sete de Setembro', 'Centro', '89201-200'],
  ['SC', 'Joinville', 'Rua Rio Branco', 'Centro', '89201-080'],
  ['RS', 'Porto Alegre', 'Rua Pau-Brasil', 'Hípica', '91755-670'],
  ['RS', 'Porto Alegre', 'Rua Vital Brasil', 'Jardim Sabará', '91210-320'],
  ['RS', 'Porto Alegre', 'Rua Santos', 'Campo Novo', '91750-150'],
  ['RS', 'Porto Alegre', 'Rua Santos Neto', 'Petrópolis', '90460-090'],
  ['RS', 'Porto Alegre', 'Rua Rio Branco', 'Santa Tereza', '90850-370'],
  ['RS', 'Porto Alegre', 'Rua Rio Branco', 'Lomba do Pinheiro', '91570-090'],
  ['RS', 'Caxias do Sul', 'Avenida Brasil', 'Jardelino Ramos', '95050-055'],
  ['RS', 'Caxias do Sul', 'Avenida Brasil', 'Sagrada Família', '95052-022'],
  ['RS', 'Caxias do Sul', 'Rua Santos Lemos', 'Kayser', '95096-390'],
  ['RS', 'Caxias do Sul', 'Rua Adyles dos Santos', 'Reolon', '95112-465'],
  ['RS', 'Caxias do Sul', 'Rua 27 de Setembro', 'Santa Corona', '95088-247'],
  ['RS', 'Caxias do Sul', 'Rua Sete de Setembro', 'Rio Branco', '95097-790'],
]

/** DDDs em uso em cada estado. O celular sai coerente com a UF do endereço. */
const DDDS: Record<string, readonly number[]> = {
  AC: [68], AL: [82], AM: [92, 97], AP: [96],
  BA: [71, 73, 74, 75, 77], CE: [85, 88], DF: [61], ES: [27, 28],
  GO: [62, 64], MA: [98, 99], MG: [31, 32, 33, 34, 35, 37, 38], MS: [67],
  MT: [65, 66], PA: [91, 93, 94], PB: [83], PE: [81, 87],
  PI: [86, 89], PR: [41, 42, 43, 44, 45, 46], RJ: [21, 22, 24], RN: [84],
  RO: [69], RR: [95], RS: [51, 53, 54, 55], SC: [47, 48, 49],
  SE: [79], SP: [11, 12, 13, 14, 15, 16, 17, 18, 19], TO: [63]
}

// -------------------------------------------------------------- peças soltas

function gerarEndereco(base: EnderecoReal): Endereco {
  const [uf, cidade, logradouro, bairro, cep] = base
  return {
    logradouro,
    numero: String(inteiro(1, 2500)),
    complemento: sortear(COMPLEMENTOS),
    bairro,
    cidade,
    uf,
    cep
  }
}

function gerarCelular(uf: string): string {
  // Celular no Brasil tem nove dígitos e começa com 9 desde 2016.
  return `(${sortear(DDDS[uf])}) 9${digitos(4)}-${digitos(4)}`
}

function gerarFixo(uf: string): string {
  // Fixo tem oito dígitos e o primeiro vai de 2 a 5.
  return `(${sortear(DDDS[uf])}) ${inteiro(2, 5)}${digitos(3)}-${digitos(4)}`
}

/**
 * Data entre `anosAtrasDe` e `anosAtrasAte` anos atrás, contados do dia de hoje.
 *
 * Os limites são a data de hoje deslocada, não 31/12 do ano: com o ano inteiro,
 * quem nasceu em dezembro ainda não fez aniversário e sai com um ano a menos
 * que o pedido — era assim que 0,4% das pessoas geradas vinham com 17 anos.
 */
function dataAleatoria(anosAtrasDe: number, anosAtrasAte: number): Date {
  const hoje = new Date()
  const recente = new Date(hoje.getFullYear() - anosAtrasDe, hoje.getMonth(), hoje.getDate())
  const antiga = new Date(hoje.getFullYear() - anosAtrasAte, hoje.getMonth(), hoje.getDate())
  return new Date(antiga.getTime() + Math.random() * (recente.getTime() - antiga.getTime()))
}

export function formatarData(d: Date): string {
  return d.toLocaleDateString('pt-BR')
}

function idadeEm(nascimento: Date): number {
  const hoje = new Date()
  let anos = hoje.getFullYear() - nascimento.getFullYear()
  const mes = hoje.getMonth() - nascimento.getMonth()
  if (mes < 0 || (mes === 0 && hoje.getDate() < nascimento.getDate())) anos--
  return anos
}

/**
 * RG não tem algoritmo nacional — cada estado emite do seu jeito, e vários não
 * usam dígito verificador. Isto é só a forma, para preencher campo; não tente
 * validar com módulo 11.
 */
function gerarRg(): string {
  return `${digitos(2)}.${digitos(3)}.${digitos(3)}-${sortear(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'X'])}`
}

function emailDe(partes: string[], dominio = sortear(DOMINIOS)): string {
  const base = partes.map(semAcento).join('.').replace(/[^a-z0-9.]/g, '')
  return `${base}${inteiro(1, 999)}@${dominio}`
}

// -------------------------------------------------------------------- pessoa

export function gerarPessoa(): Pessoa {
  const sexo: Sexo = Math.random() < 0.5 ? 'feminino' : 'masculino'
  const primeiro = sortear(sexo === 'feminino' ? NOMES_FEMININOS : NOMES_MASCULINOS)
  const meio = sortear(SOBRENOMES)
  const ultimo = sortear(SOBRENOMES)
  const nascimento = dataAleatoria(18, 80)
  const base = sortear(ENDERECOS)

  return {
    nome: `${primeiro} ${meio} ${ultimo}`,
    sexo,
    nascimento: formatarData(nascimento),
    idade: idadeEm(nascimento),
    cpf: documentoPorTipo('cpf').formatar(documentoPorTipo('cpf').gerar()),
    rg: gerarRg(),
    pis: documentoPorTipo('pis').formatar(documentoPorTipo('pis').gerar()),
    cns: documentoPorTipo('cns').formatar(documentoPorTipo('cns').gerar()),
    email: emailDe([primeiro, ultimo]),
    celular: gerarCelular(base[0]),
    // A mãe mantém o último sobrenome; é o padrão que soa certo em cadastro.
    nomeDaMae: `${sortear(NOMES_FEMININOS)} ${sortear(SOBRENOMES)} ${ultimo}`,
    endereco: gerarEndereco(base)
  }
}

// ------------------------------------------------------------------- empresa

export function gerarEmpresa(opcoes?: OpcoesGeracao): Empresa {
  const base = sortear(ENDERECOS)
  const sobrenome = sortear(SOBRENOMES)
  const ramo = sortear(RAMOS)
  const sufixo = sortear(SUFIXOS_EMPRESA)
  const fantasia = `${sobrenome} ${ramo.split(' ')[0]}`
  const cnpj = documentoPorTipo('cnpj')
  const cpf = documentoPorTipo('cpf')
  const responsavel = sortear([...NOMES_FEMININOS, ...NOMES_MASCULINOS])

  return {
    razaoSocial: `${sobrenome} ${ramo} ${sufixo}`,
    nomeFantasia: fantasia,
    cnpj: cnpj.formatar(cnpj.gerar(opcoes)),
    abertura: formatarData(dataAleatoria(1, 40)),
    ramo,
    email: emailDe(['contato', sobrenome]),
    telefone: gerarFixo(base[0]),
    endereco: gerarEndereco(base),
    responsavel: {
      nome: `${responsavel} ${sortear(SOBRENOMES)}`,
      cpf: cpf.formatar(cpf.gerar())
    }
  }
}

// ----------------------------------------------------------------- exportação

export function enderecoEmLinha(e: Endereco): string {
  const complemento = e.complemento ? `, ${e.complemento}` : ''
  return `${e.logradouro}, ${e.numero}${complemento} — ${e.bairro}, ${e.cidade}/${e.uf}, CEP ${e.cep}`
}

/** Pares rótulo/valor na ordem em que a tela mostra, e que o CSV segue. */
export function camposDaPessoa(p: Pessoa): [string, string][] {
  return [
    ['Nome', p.nome],
    ['Sexo', p.sexo === 'feminino' ? 'Feminino' : 'Masculino'],
    ['Nascimento', `${p.nascimento} (${p.idade} anos)`],
    ['CPF', p.cpf],
    ['RG', p.rg],
    ['PIS/PASEP', p.pis],
    ['CNS', p.cns],
    ['E-mail', p.email],
    ['Celular', p.celular],
    ['Nome da mãe', p.nomeDaMae],
    ['Endereço', enderecoEmLinha(p.endereco)]
  ]
}

export function camposDaEmpresa(e: Empresa): [string, string][] {
  return [
    ['Razão social', e.razaoSocial],
    ['Nome fantasia', e.nomeFantasia],
    ['CNPJ', e.cnpj],
    ['Abertura', e.abertura],
    ['Ramo', e.ramo],
    ['E-mail', e.email],
    ['Telefone', e.telefone],
    ['Responsável', `${e.responsavel.nome} — CPF ${e.responsavel.cpf}`],
    ['Endereço', enderecoEmLinha(e.endereco)]
  ]
}

/** Aspas duplicadas e campo entre aspas: o que o Excel espera. */
function celulaCsv(valor: string): string {
  return `"${valor.replace(/"/g, '""')}"`
}

export function paraCsv(registros: [string, string][][]): string {
  if (registros.length === 0) return ''
  const cabecalho = registros[0].map(([rotulo]) => celulaCsv(rotulo)).join(';')
  const linhas = registros.map((r) => r.map(([, valor]) => celulaCsv(valor)).join(';'))
  // BOM para o Excel em português abrir como UTF-8 em vez de ANSI.
  return `﻿${[cabecalho, ...linhas].join('\r\n')}`
}

export function paraTexto(registros: [string, string][][]): string {
  return registros
    .map((campos) => campos.map(([rotulo, valor]) => `${rotulo}: ${valor}`).join('\n'))
    .join('\n\n')
}
