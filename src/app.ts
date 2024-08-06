import "dotenv/config"
import { createBot, createProvider, createFlow, addKeyword, EVENTS } from '@builderbot/bot'
import { MemoryDB as Database } from '@builderbot/bot'
// import { BaileysProvider as Provider } from '@builderbot/provider-baileys'
import { InstagramProvider as Provider } from './provider/instagram'

const PORT = process.env.PORT ?? 3008


const welcomeFlow = addKeyword<Provider, Database>(EVENTS.WELCOME)
    .addAction(async (ctx, { flowDynamic }) => {
        try {
            await flowDynamic(`All merged messages: ${ctx.body}`);
        } catch (error) {
            console.error('Error al procesar el mensaje:', error);
        }
    });

const mediaFlow = addKeyword<Provider, Database>(EVENTS.MEDIA)
    .addAction(async (ctx, { flowDynamic }) => {
        try {
            await flowDynamic(`me enviaste un media`);
        } catch (error) {
            console.error('Error al procesar el mensaje:', error);
        }
    });

const voiceFlow = addKeyword<Provider, Database>(EVENTS.VOICE_NOTE)
    .addAction(async (ctx, { flowDynamic }) => {
        try {
            await flowDynamic(`me enviaste un audio`);
        } catch (error) {
            console.error('Error al procesar el mensaje:', error);
        }
    });

const documentFlow = addKeyword<Provider, Database>(EVENTS.DOCUMENT)
    .addAction(async (ctx, { flowDynamic }) => {
        try {
            await flowDynamic(`me enviaste un documento`);
        } catch (error) {
            console.error('Error al procesar el mensaje:', error);
        }
    });

// const welcomeFlow = addKeyword<Provider, Database>(['test', 'banana'])
// .addAction(async (ctx, { flowDynamic }) => {
//     try {
//         enqueueMessage(ctx.body, async (body) => {
//             await flowDynamic(`All merged messages: ${body}`);
//         });
//     } catch (error) {
//         console.error('Error al procesar el mensaje:', error);
//     }
// });


const main = async () => {
    const adapterFlow = createFlow([welcomeFlow, mediaFlow, documentFlow, voiceFlow])

    const adapterProvider = createProvider(Provider, {
        accessToken: process.env.INSTAGRAM_ACCESS_TOKEN,
        userId: process.env.INSTAGRAM_USER_ID,
        verifyToken: process.env.INSTAGRAM_VERIFY_TOKEN,
        version: 'v12.0'
    })

    const adapterDB = new Database()

    const { handleCtx, httpServer } = await createBot({
        flow: adapterFlow,
        provider: adapterProvider,
        database: adapterDB,
    })

    adapterProvider.server.post(
        '/v1/messages',
        handleCtx(async (bot, req, res) => {
            const { number, message, urlMedia } = req.body
            await bot.sendMessage(number, message, { media: urlMedia ?? null })
            return res.end('sended')
        })
    )

    adapterProvider.server.post(
        '/v1/register',
        handleCtx(async (bot, req, res) => {
            const { number, name } = req.body
            await bot.dispatch('REGISTER_FLOW', { from: number, name })
            return res.end('trigger')
        })
    )

    adapterProvider.server.post(
        '/v1/samples',
        handleCtx(async (bot, req, res) => {
            const { number, name } = req.body
            await bot.dispatch('SAMPLES', { from: number, name })
            return res.end('trigger')
        })
    )

    adapterProvider.server.post(
        '/v1/blacklist',
        handleCtx(async (bot, req, res) => {
            const { number, intent } = req.body
            if (intent === 'remove') bot.blacklist.remove(number)
            if (intent === 'add') bot.blacklist.add(number)

            res.writeHead(200, { 'Content-Type': 'application/json' })
            return res.end(JSON.stringify({ status: 'ok', number, intent }))
        })
    )

    httpServer(+PORT)
}

main()
