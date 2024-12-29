const cheerio = require('cheerio')
const dayjs = require('dayjs')
const utc = require('dayjs/plugin/utc')
const doFetch = require('@ntlab/sfetch')
const debug = require('debug')('site:sky.com')

dayjs.extend(utc)

doFetch.setDebugger(debug)

module.exports = {
  site: 'sky.com',
  days: 2,
  url({ date, channel }) {
    return `https://awk.epgsky.com/hawk/linear/schedule/${
      date.format('YYYYMMDD')
    }/${
      channel.site_id
    }`
  },
  parser({ content, channel }) {
    const programs = []
    if (content) {
      const items = JSON.parse(content) || null
      if (Array.isArray(items.schedule)) {
        items.schedule
          .filter(schedule => schedule.sid === channel.site_id)
          .forEach(schedule => {
            if (Array.isArray(schedule.events)) {
              schedule.events
                .forEach(event => {
                  const start = dayjs.utc(event.st * 1000)
                  const stop = start.add(event.d, 's')
                  programs.push({
                    title: event.t,
                    description: event.sy,
                    season: event.seasonnumber,
                    episode: event.episodenumber,
                    start,
                    stop
                  })
                })
            }
          })
      }
    }

    return programs
  },
  async channels() {
    const channels = {}
    const queues = [{ t: 'r', url: 'https://www.sky.com/tv-guide' }]
    await doFetch(queues, (queue, res) => {
      // process regions
      if (queue.t === 'r') {
        const $ = cheerio.load(res)
        const initialData = JSON.parse(decodeURIComponent($('#initialData').text()))
        initialData.state.epgData.regions
          .forEach(region => {
            queues.push({ t: 'c', url: `https://awk.epgsky.com/hawk/linear/services/${region.bouquet}/${region.subBouquet}` })
          })
      }
      // process channels
      if (queue.t === 'c') {
        if (Array.isArray(res.services)) {
          for (const ch of res.services) {
            if (channels[ch.sid] === undefined) {
              channels[ch.sid] = {
                lang: 'en',
                site_id: ch.sid,
                name: ch.t
              }
            }
          }
        }
      }
    })

    return Object.values(channels)
  }
}