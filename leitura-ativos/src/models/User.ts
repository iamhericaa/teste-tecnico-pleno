// model representa os dados de um usuário no sistema.
// Em programação orientada a objetos, uma classe descreve dados + comportamento.
export class User {
  constructor(
    public id: number,
    public name: string,
    public email: string
  ) {}
}
