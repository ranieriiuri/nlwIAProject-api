import { PrismaClient } from '@prisma/client'

export const prisma = new PrismaClient() 
//Essa configuração instanciada e exportada já faz a conexão com o BD