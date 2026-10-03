import type { NextApiRequest, NextApiResponse } from 'next'
import { Server as SocketIOServer } from 'socket.io'

type NextApiResponseWithSocket = NextApiResponse & {
  socket: NextApiResponse['socket'] & {
    server: NextApiResponse['socket']['server'] & {
      io?: SocketIOServer
    }
  }
}

export default function handler(
  _req: NextApiRequest,
  res: NextApiResponseWithSocket,
) {
  if (!res.socket.server.io) {
    const io = new SocketIOServer(res.socket.server, {
      path: '/api/socket',
      addTrailingSlash: false,
    })

    io.on('connection', (socket) => {
      socket.on('telemetry_update', (data) => {
        socket.broadcast.emit('telemetry_stream', data)
      })

      socket.on('send_command', (command) => {
        socket.broadcast.emit('execute_command', command)
      })
    })

    res.socket.server.io = io
  }

  res.end()
}

export const config = {
  api: {
    bodyParser: false,
  },
}
