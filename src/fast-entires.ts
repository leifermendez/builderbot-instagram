/**
 * @file messageQueue.ts
 * @description A functional implementation of a message queueing system with debounce functionality.
 */

interface Message {
    text: string;
    timestamp: number;
}

interface QueueConfig {
    gapSeconds: number;
}

interface QueueState {
    queue: Message[];
    timer: NodeJS.Timeout | null;
    callback: ((body: string) => void) | null;
}

function createInitialState(): QueueState {
    return {
        queue: [],
        timer: null,
        callback: null
    };
}

function resetTimer(state: QueueState): QueueState {
    if (state.timer) {
        clearTimeout(state.timer);
    }
    return { ...state, timer: null };
}

function processQueue(state: QueueState): [string, QueueState] {
    const result = state.queue.map(message => message.text).join(" ");
    console.log('Accumulated messages:', result);

    const newState = {
        ...state,
        queue: [],
        timer: null
    };

    return [result, newState];
}

function createMessageQueue(config: QueueConfig) {
    let state = createInitialState();

    return function enqueueMessage(messageText: string, callback: (body: string) => void): void {
        console.log('Enqueueing:', messageText);

        state = resetTimer(state);
        state.queue.push({ text: messageText, timestamp: Date.now() });
        state.callback = callback;

        state.timer = setTimeout(() => {
            const [result, newState] = processQueue(state);
            state = newState;
            if (state.callback) {
                state.callback(result);
                state.callback = null;
            }
        }, config.gapSeconds);
    };
}

export { createMessageQueue, QueueConfig };