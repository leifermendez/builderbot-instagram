import { Middleware } from 'polka';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { ProviderClass } from "@builderbot/bot";
import { BotContext, GlobalVendorArgs, SendOptions } from "@builderbot/bot/dist/types";
import { InstagramEvents } from "./instagram.events";
import axios, { AxiosResponse } from 'axios';
import FormData from 'form-data';
import mime from 'mime-types';

const INSTAGRAM_API_URL = 'https://graph.instagram.com/';

export type InstagramArgs = GlobalVendorArgs & { accessToken: string, userId: string, version: string };

export class InstagramProvider extends ProviderClass<InstagramEvents> {
    globalVendorArgs: InstagramArgs = {
        name: 'instagram-bot',
        port: 3000,
        accessToken: undefined,
        userId: undefined,
        version: 'v19.0',
        verifyToken: undefined
    };

    constructor(args?: InstagramArgs) {
        super();
        this.globalVendorArgs = { ...this.globalVendorArgs, ...args };
        if (!this.globalVendorArgs.accessToken) {
            throw new Error('Must provide Instagram Access Token');
        }
        if (!this.globalVendorArgs.userId) {
            throw new Error('Must provide Instagram User ID');
        }
        if (!this.globalVendorArgs.verifyToken) {
            throw new Error('Must provide Instagram Verify Token');
        }
    }

    protected async initVendor(): Promise<any> {
        const vendor = new InstagramEvents();
        this.vendor = vendor;
        this.server = this.server
            .post('/webhook', this.ctrlInMsg)
            .get('/webhook', this.ctrlVerify)
            .get('/webhook/verify', this.redirectCtrl)



        await this.checkStatus();
        return vendor;
    }

    protected beforeHttpServerInit(): void { }

    protected afterHttpServerInit(): void { }

    protected busEvents = (): { event: string; func: Function; }[] => {
        return [
            {
                event: 'auth_failure',
                func: (payload: any) => this.emit('auth_failure', payload),
            },
            {
                event: 'ready',
                func: () => this.emit('ready', true),
            },
            {
                event: 'message',
                func: (payload: BotContext) => {
                    this.emit('message', payload);
                },
            }
        ];
    }

    private async downloadFile(mediaUrl: string): Promise<{ buffer: Buffer; extension: string }> {
        try {
            const response: AxiosResponse = await axios.get(mediaUrl, {
                headers: {
                    Authorization: `Bearer ${this.globalVendorArgs.accessToken}`,
                },
                responseType: 'arraybuffer',
            });
            const contentType = response.headers['content-type'];
            const ext = mime.extension(contentType);
            if (!ext) throw new Error('Unable to determine file extension');
            return {
                buffer: response.data,
                extension: ext,
            };
        } catch (error) {
            console.error(error.message);
            throw error;
        }
    }

    protected ctrlInMsg: Middleware = (req, res) => {
        this.vendor.eventInMsg(req.body);
        return res.end('ok');
    }

    protected redirectCtrl: Middleware = (req, res) => {
        return res.redirect(301, 'https://www.google.com');
    }

    protected ctrlVerify: Middleware = (req, res) => {
        console.log(req.body)
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];

        // Verifica que todos los parámetros necesarios estén presentes
        if (!mode || !token || !challenge) {
            console.error('Missing parameters in webhook verification request');
            return res.end('ok');
        }

        // Verifica que el modo sea 'subscribe'
        if (mode !== 'subscribe') {
            console.error('Invalid mode in webhook verification request');
            return res.end('ok');
        }

        // Verifica el token
        if (token !== this.globalVendorArgs.verifyToken) {
            console.error('Invalid verify token in webhook verification request');
            return res.end('ok');
        }

        // Si todo está correcto, responde con el desafío
        console.log('Webhook verified successfully');
        return res.end(challenge);
    }

    private async uploadMedia(file: Buffer, mimeType: string): Promise<string> {
        const formData = new FormData();
        formData.append('file', file, { contentType: mimeType });

        try {
            const response = await axios.post(
                `${INSTAGRAM_API_URL}/${this.globalVendorArgs.version}/${this.globalVendorArgs.userId}/media`,
                formData,
                {
                    headers: {
                        ...formData.getHeaders(),
                        Authorization: `Bearer ${this.globalVendorArgs.accessToken}`,
                    },
                }
            );
            return response.data.id;
        } catch (err) {
            console.error('Error uploading media:', err.response?.data || err.message);
            throw err;
        }
    }

    async checkStatus(): Promise<void> {
        try {
            const _url = `${INSTAGRAM_API_URL}${this.globalVendorArgs.version}/me/accounts`;
            console.log(`Checking status with URL:`, _url);
            const response = await axios.get(_url, {
                params: {
                    access_token: this.globalVendorArgs.accessToken,
                },
            });
            if (response.status === 200) {
                console.log('Successfully authenticated with Instagram API');
                this.emit('ready');
            } else {
                console.error('Unexpected response status:', response.status);
                this.emit('auth_failure', {
                    instructions: [
                        'Failed to authenticate with Instagram API',
                        'Please check your access token and ensure it has the necessary permissions',
                    ],
                });
            }
        } catch (err) {
            console.error('Error checking status:', err.response?.data || err.message);
            this.emit('auth_failure', {
                instructions: [
                    'An error occurred while checking the API status',
                    `Error details: ${err.response?.data?.error?.message || err.message}`,
                    'Please verify your access token and Instagram Business Account ID',
                ],
            });
        }
    }

    sendMessage = async (userId: string, message: string, options?: SendOptions): Promise<any> => {
        const url = `https://graph.facebook.com/${this.globalVendorArgs.version}/${this.globalVendorArgs.userId}/messages`;
        try {
            const body = {
                recipient: { id: userId },
                message: { text: message },
                access_token: this.globalVendorArgs.accessToken
            }


            const response = await axios.post(url, body);

            console.log('Message sent successfully');
            return response.data;
        } catch (error) {
            console.error('Error sending message:', error.response?.data || error.message);
            throw new Error('Failed to send message');
        }
    }

    async saveFile(ctx: BotContext, options?: { path: string }): Promise<string> {
        if (!ctx?.data?.media?.url) return '';
        try {
            const { buffer, extension } = await this.downloadFile(ctx.data.media.url);
            const fileName = `file-${Date.now()}.${extension}`;
            const pathFile = join(options?.path ?? tmpdir(), fileName);
            await writeFile(pathFile, buffer);
            return pathFile;
        } catch (err) {
            console.error('Error saving file:', err.message);
            return 'ERROR';
        }
    }
}