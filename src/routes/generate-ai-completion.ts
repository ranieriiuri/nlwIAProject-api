import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { z } from "zod";
import { openai } from "../lib/openai";
import { OpenAIStream, streamToResponse } from "ai";

export async function generateAiCompletionRoute (app: FastifyInstance) {
    app.post('/ai/complete', async (req, res) => {
        
        //Usando o zod p definir o padrão 'objeto' pras informações que queremos receber do body
        const bodySchema = z.object({
            videoId: z.string().uuid(),
            prompt: z.string(),
            temperature: z.number().min(0).max(1).default(0.5)
        })
        //usando o método 'parse' p fazer a verificação dentro do padrão definido com o zod
        const { videoId, prompt, temperature } = bodySchema.parse(req.body)

        //faz a verificação pelo id
        const video = await prisma.video.findUniqueOrThrow({
            where: {
                id: videoId
            }
        })
        //se o video não tiver transcrição...
        if(!video.transcription) {
            return res.status(400).send({ error: 'Video transcription was not generated yet.'})
        }
        //se tiver, substitui a transcrição atual dele pela transcrição gerada, gerando a mensagem de prompt q usaremos p enviar pra ia criar a descrição
        const promptMessage = prompt.replace('{transcription}', video.transcription)

        //fará uma chamada p openai, passando o modelo q queremos usar, a temperatura de geração, mensagem transcrita pra ela gerar as descrições e titulos e validade o 'stream'
        const response = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo-16k',
            temperature,
            messages: [
                {role: 'user', content: promptMessage}
            ],
            stream: true
        })
        
        const stream = OpenAIStream(response) //instanciando a resposta no modelo OpenAIStream

        //com o método vercel ai module 'streamToResponse' passaremos: stream(modelo de resposta passada acima), res.raw(resposta com a geração de transcrição ai de forma nativa 'raw' do node), e obj com definições 'Cors'(já q nenhuma definição do Fastify funciona qnd tratamos respostas em raw)
        streamToResponse(stream, res.raw, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
            }
        })
    })
}