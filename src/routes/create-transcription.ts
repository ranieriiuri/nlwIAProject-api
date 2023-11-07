import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { z } from "zod";
import { createReadStream } from "fs";
import { openai } from "../lib/openai";

export async function createTranscriptionRoute (app: FastifyInstance) {
    app.post('/videos/:videoId/transcription', async (req) => {
        //formato definido p validação. Obj com videoId no formato string no formato uuid(formato salvo no BD)
        const paramsSchema = z.object({ 
            videoId: z.string().uuid()
        }) 

        const { videoId } = paramsSchema.parse(req.params) //O 'parse' faz essa validação quanto ao form definido acima

        //pegando o prompt p ajudar a IA. Mesma forma de validação usada acima
        const bodySchema = z.object({
            prompt: z.string()
        })

        const { prompt } = bodySchema.parse(req.body) //parse validação

        //Esse método acha um arquivo(verificação) ou dispara um erro. Neste caso, vai fazer o match, onde(where) o id seja igual ao videoID
        const video = await prisma.video.findUniqueOrThrow({
            where: {
                id: videoId
            }
        })

        const videoPath = video.path

        const audioReadStream = createReadStream(videoPath) //método de streams do node que possibilita ler aos poucos, passamos como parâmetro o caminho do video

        //aqui instanciamos a transcrição da openAI, fazendo algumas definições com o método 'create'
        const response = await openai.audio.transcriptions.create({
            file: audioReadStream,
            model: 'whisper-1',
            language: 'pt',
            response_format: 'json',
            temperature: 0,
            prompt
        })

        const transcription = response.text //será usada pra guardar a transcrição no BD

        //Atualizará o video onde o id for igual a videoId(verificação) e os dados dele serão atualizados pela transcrição e retornará como resposta ao browser tbm
        await prisma.video.update({
            where: {
                id: videoId 
            },
            data: {
                transcription
            }
        })

        return { transcription }
    })
}