import { Client, GatewayIntentBits, TextChannel } from 'discord.js';
import { generateSlug } from 'random-word-slugs';
import { addPoint, getStandings } from './standings';

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildModeration, GatewayIntentBits.GuildMessages, GatewayIntentBits.DirectMessages] });

const token = process.env.DISCORD_TOKEN;
const channelId = process.env.CHANNEL_ID;
const privateChannelId = process.env.PRIVATE_CHANNEL_ID;
const intervalMinutes = process.env.INTERVAL_MINUTES ? parseInt(process.env.INTERVAL_MINUTES) : 5;
const intervalVariance = process.env.INTERVAL_VARIANCE ? parseInt(process.env.INTERVAL_VARIANCE) : 0;
const rapidFire = process.env.RAPID_FIRE ? parseInt(process.env.RAPID_FIRE) : 1;
let rapidFireCounter = rapidFire;

if (!token) throw new Error('ENV needs to have DISCORD_TOKEN');
if (!channelId) throw new Error('ENV needs to have CHANNEL_ID');

let channel: TextChannel;
client.once('ready', async () => {
	console.log('Bot is online!');
	channel = (await client.channels.fetch(channelId)) as TextChannel;
	if (privateChannelId) {
		console.warn('⚠️ Doing DEV mode because ENV has PRIVATE_CHANNEL_ID');
		channel = (await client.channels.fetch(privateChannelId)) as TextChannel;
	}
	if (!channel) {
		console.error('Channel not found!');
		throw new Error('Channel not found!');
	}
	// await channel.send("Hello, world!");
	// sendRandomMessage();
	askQuestion();
	// setInterval(askQuestion, intervalMinutes * 60 * 1000);
	initSleepLoop();
});

let currentQuestion: Question | null = null;
const questions: (() => Question | Promise<Question>)[] = [
	() => {
		const a = Math.floor(Math.random() * 100);
		const b = Math.floor(Math.random() * 100);
		return { q: `What is \`${a} + ${b}\`?`, a: `${a + b}`, category: 'simple addition' };
	},
	() => {
		const thingToSay = generateSlug(3, { format: 'sentence' });
		return {
			q: `Say: \`${thingToSay.toLowerCase()}\` in uppercase`,
			a: thingToSay.toUpperCase(),
			category: 'random uppercase',
		};
	},
	() => {
		const thingToSay = generateSlug(3, { format: 'sentence' });
		return {
			q: `Say: \`${thingToSay.toUpperCase()}\` in lowercase`,
			a: thingToSay.toLowerCase(),
			category: 'random lowercase',
		};
	},
	async () => {
		interface TriviaResponse {
			response_code: number;
			results: {
				category: string;
				type: string;
				difficulty: string;
				question: string;
				correct_answer: string;
				incorrect_answers: string[];
			}[];
		}
		const resp = await fetch('https://opentdb.com/api.php?amount=1&difficulty=easy&type=multiple').then((res) => res.json() as Promise<TriviaResponse>);
		if (!resp.results || !Array.isArray(resp.results) || resp.results.length == 0) throw new Error('Invalid response when getting trivia');
		const question = resp.results[0];
		const sanitize = (str: string) =>
			str
				.replace(/&quot;/g, '"')
				.replace(/&#039;/g, "'")
				.replace(/&[lr]dquo;/g, "'")
				.replace('&amp;', '&')
				.trim();
		let q = sanitize(question.question);
		const answers = [question.correct_answer, ...question.incorrect_answers];
		answers.sort(() => Math.random() - 0.5);

		return {
			q: `${q}\n` + answers.map((a, i) => `- ${sanitize(a)}`).join('\n'),
			a: sanitize(question.correct_answer),
			caseInsensitive: true,
			category: 'trivia + ' + question.category,
		};
	},
];
const standings: Record<string, number> = {};

client.on('messageCreate', async (message) => {
	if (message.channel.id === channel.id) {
		const msgDtls = await message.fetch();
		const providedAnswer = msgDtls.content;

		const name = msgDtls.member?.displayName ?? msgDtls.author.displayName;
		// console.log(`Message from: ${name} - ${providedAnswer}`);

		if (name == 'office games') return; // no need to respond when we sent the message

		if (currentQuestion) {
			let isCorrect = currentQuestion.caseInsensitive ? currentQuestion.a.toLowerCase() === providedAnswer.toLowerCase() : currentQuestion.a === providedAnswer;
			if (isCorrect) {
				console.log(`Correct answer '${providedAnswer}' from: ${name}`);

				if (!standings[name]) standings[name] = 0;
				standings[name]++;

				addPoint(channel, name, currentQuestion);

				currentQuestion = null;

				msgDtls.react('✅');

				if (rapidFireCounter > 0) {
					rapidFireCounter--;
					askQuestion();
				}
			} else {
				msgDtls.react('❌');
				console.log(`Inorrect answer '${providedAnswer}' != '${currentQuestion.a}' from: ${name}`);
			}
		}

		if (providedAnswer == 'standings') {
			const standingsMsg = getStandings(channel);
			channel.send('```\n' + standingsMsg + '\n```');
		}
	}
});

async function askQuestion() {
	console.log('Asking question ...');
	try {
		const questionN = Math.floor(Math.random() * questions.length);
		const processingQuestion = questions[questionN];
		const question_parts = await processingQuestion();
		let { q, a } = question_parts;
		currentQuestion = { q, a, caseInsensitive: question_parts.caseInsensitive, category: question_parts.category };
		console.log(`  > ${currentQuestion.q}`);
		channel.send(q);
	} catch (error) {
		console.error('Unable to ask questions', error);
	}
}

let readyToAskOn;
function initSleepLoop() {
	setInterval(() => {
		if (!readyToAskOn) {
			//ask the question between 25-35 minutes randomly
			let randomTime = Math.floor(Math.random() * intervalVariance) + intervalMinutes;
			// TODO: make the business hours only optional. should it consider timezones?
			let askTime = new Date(new Date().getTime() + randomTime * 60 * 1000);
			if(askTime.getHours() >= 17) {  // If after 5pm 
				if(askTime.getDay() == 5){ // After 5pm on Friday
					randomTime+=3780; // wait 2 days and 15 hours (Mon 8am)
				} else if(askTime.getDay() == 6){ // After 5pm on Saturday -- shouldn't be necessary
					randomTime+=2340; // wait 1 days and 15 hours (Mon 8am)
				} else { // After 5pm not Friday or Saturday
					randomTime+=900; // wait 15 hours (Next day 8am)
				}
			}
			readyToAskOn = new Date().getTime() + randomTime * 60 * 1000;
			console.log(`Next question in ${randomTime} minutes: ${readyToAskOn}`);
			rapidFireCounter = rapidFire;
		}
		const now = new Date().getTime();
		if (now >= readyToAskOn) {
			askQuestion();
			readyToAskOn = null;
		}
	}, 5000); // every 5 seconds
}

client.login(token);
