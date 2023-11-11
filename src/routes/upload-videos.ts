import { FastifyInstance } from "fastify";
import { fastifyMultipart } from "@fastify/multipart";
import { prisma } from "../lib/prisma";
import path from "node:path"; //apenas um modelo de escrita aceita nas novas versões do node p indicar q é um módulo interno do node e não de um pacote do npm
import { randomUUID } from "node:crypto";
import AWS from 'aws-sdk';
import dotenv from 'dotenv';

/* IMPORTAÇÕES QUE NÃO USAREMOS P O ARMAZENAMENTO NO BUCKET S3

    //import  fs  from 'node:fs' --> P/ file systems, como usaremos o s3, não será necessário
    //import { pipeline } from "node:stream"; --> P/ stream de arq upados e salvos no disco, não usaremos!
    //import { promisify } from "node:util"; --> mesma lógica de cima
*/

//const pump = promisify(pipeline) //var que instancia o pipeline convertido de callback p promise com o promisify (usada pra realizar stream dos arq que seriam guardados em disco local) 

// carregando variáveis de ambiente do arq '.env'
dotenv.config();

// Criando um s3 client
const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION,
});

// Declarando globalmente variável q será usada localmente (abaixo) no envio do arq upado p o bucket s3
let s3UploadResponse: AWS.S3.ManagedUpload.SendData;

export async function uploadVideosRoute (app: FastifyInstance) {
    app.register(fastifyMultipart, {
        limits: {
            fileSize: 1_048_576 * 25 //1mb x 25 = 25mb lim. máx
        }
    })
    

    app.post('/videos', async (req, res) => {
        const data = await req.file() //pega o arquivo postado na requisição e instancia em 'data'
        
        //se na req não vier arquivo...
        if(!data) {
            return res.status(400).send({ error: 'Missing file input.'})
        }

        //senão
        const extension = path.extname(data.filename) //retorna a extensão do arq usando o módulo 'path', interno do node
        //Já faremos a conversão 'mp4Tomp3' no browser, o back-end já receberá em mp3!

        if (extension != '.mp3') {
            return res.status(400).send({ error: 'Invalid input type. Please, upload a mp3.'})
        }

        const fileBasename = path.basename(data.filename, extension) //retorna o nome da arq sem a extensão
        const fileUploadName = `${fileBasename}-${randomUUID()}${extension}` //criando novo nome do arq. (imaginando q podem vir arquivos com o mesmo nome na requisição). Pega o nome original do arq - gera um id único universal com o 'randomUUID'e a extensão

        // const q traz infos do bucket q será acessado, do nome e corpo do arq upado no front
        const uploadParams = {
            Bucket: 'plasmator-mp3files-storage',
            Key: fileUploadName,
            Body: data.file,
          };
      
          // Fazendo upload p s3
          try {
            s3UploadResponse = await s3.upload(uploadParams).promise();
          
            // verificação de sucesso
            if (s3UploadResponse.Location) {
              console.log('File uploaded successfully:', s3UploadResponse.Location);

            } else {
              console.error('S3 upload failed:', s3UploadResponse);
              // caso falhe
            }
          } catch (error) {
            console.error('Error uploading file to S3:', error);
            // manuseando o erro
          }
      
          const fileSizeInBytes = data.file.readableLength;
          const fileSizeInMB = fileSizeInBytes / (1024 * 1024);
          const roundedFileSizeInMB = Math.round(fileSizeInMB * 100) / 100;

        /* USADOS QND O ARMAZ. ERA NO PC LOCAL

            //const uploadDestination = path.resolve(__dirname, '../../tmp', fileUploadName) --> //var p definir onde o arquivo recebido será salvo. O método 'resolve' resolverá ambiguidades de comando. Neste caso, define exatamente de qual diretorio '__dirname' partirá o comando após a vírgula. Após a outra vírgula, qual será o (novo) nome do arq

            //await pump(data.file, fs.createWriteStream(uploadDestination)) --> //aguardar(await) até que os dados do arq enviado na req'(data.file)' sejam recebidos e escritos em disco 'fs.createW...' da forma que definimos em 'uploadDestination'

            //pegando infos de tam. do arquivos e já convert. p 'mb'
            //const fileSize = fs.statSync(uploadDestination).size / (1024 * 1024);
        */

        //cadastrando na tab 'video' do BD prisma com o método 'create'
        const video = await prisma.video.create({
            data: {
                name: data.filename,
                path: s3UploadResponse.Location,
                size: `${roundedFileSizeInMB}mb`
            },
        });
       
        //tudo ok? retorna esses dados de criação
        
        return {
            video
        }
        
    })
};