import { TextChannel } from 'discord.js';
import { db } from './db';
import { markdownTable } from 'markdown-table';
import { DateTime } from 'luxon';

export function addPoint(channel: TextChannel, name: string, question: Question) {
	let query = db.query('INSERT INTO points (id,createdAt,channelID,userName,category) VALUES ($id,$createdAt,$channelID,$userName,$category)');
	query.run({
		$id: null,
		$createdAt: DateTime.now().toSQL({ includeOffset: false }),
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
				let hoursQuery = db.query(`select strftime('%H',createdAt) as Hour
					from points
					WHERE channelID = $channelID AND createdAt > datetime('now', 'start of day')
					group by Hour`);
				let hours = hoursQuery.all({ $channelID: channel.id }) as { Hour: string }[];
				let hoursSelects = hours.map((h) => `count(case when strftime('%H',createdAt)='${h.Hour}' then id else null end) as '${h.Hour}'`).join(',\n'); // -4 because of timezone
				let query = db.query(`SELECT userName
							, ${hoursSelects}
							, count(id) as Points
						FROM points
						WHERE channelID = $channelID AND createdAt > datetime('now', 'start of day')
						GROUP BY userName
						ORDER BY Points DESC
						`);
				let results = query.all({ $channelID: channel.id }) as { userName: string; Points: number }[];
				if (results.length > 0) {
					message.push('Day:');
					message.push(resultsToTable(results));
				}
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

function resultsToTable(data: Record<string, string | number>[], title = '') {
	const table = [Object.keys(data[0]), ...data.map((r) => Object.values(r) as string[])];
	if (title) table[0][0] = title;
	return markdownTable(table);
}
