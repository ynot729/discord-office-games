import { TextChannel } from 'discord.js';
import { db } from './db';

export function addPoint(channel: TextChannel, name: string, question: Question) {
	let query = db.query('INSERT INTO points (id,channelID,userName,category) VALUES ($id,$channelID,$userName,$category)');
	query.run({
		$id: null,
		$channelID: channel.id,
		$userName: name,
		$category: question.category,
	});
}

export function getStandings(channel: TextChannel, type = 'all') {
	let message: string[] = [];
	const possibleTypes = ['day', 'week', 'lifetime'];
	if (type == 'all') type = possibleTypes.join(' ');
	const requestedTypes = type.split(/(,|\s+)/).filter((t) => possibleTypes.includes(t));
	for (const requestedType of requestedTypes) {
		switch (requestedType) {
			case 'day': {
				let query = db.query(`SELECT userName,count(id) as Points
						FROM points
						WHERE channelID = $channelID AND createdAt > datetime('now', 'start of day')
						GROUP BY userName
						ORDER BY Points DESC
						`);
				let results = query.all({ $channelID: channel.id }) as { userName: string; Points: number }[];
				message.push('Day:');
				results.forEach((result) => {
					message.push(`\t${result.userName}: ${result.Points}`);
				});
				break;
			}
			case 'week': {
				let query = db.query(`SELECT userName,count(id) as Points
						FROM points
						WHERE channelID = $channelID AND createdAt > datetime('now', 'weekday 0', '-7 days')
						GROUP BY userName
						ORDER BY Points DESC
						`);
				let results = query.all({ $channelID: channel.id }) as { userName: string; Points: number }[];
				message.push('Week:');
				results.forEach((result) => {
					message.push(`\t${result.userName}: ${result.Points}`);
				});
				break;
			}
			case 'lifetime': {
				let query = db.query(`SELECT userName,count(id) as Points
						FROM points
						WHERE channelID = $channelID
						GROUP BY userName
						ORDER BY Points DESC
						`);
				let results = query.all({ $channelID: channel.id }) as { userName: string; Points: number }[];
				message.push('Lifetime:');
				results.forEach((result) => {
					message.push(`\t${result.userName}: ${result.Points}`);
				});
				break;
			}
		}
		message.push('');
	}
	return message.join('\n').trim();
}
