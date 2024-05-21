const io = require('socket.io')(9999, {
    cors: {
        origin: "*"
    }
});

const dammen = require('dammen');

let games = [];

function getGameByPlayer(socketId) {
    return games.find(game => game.white === socketId || game.black === socketId);
}

function getGameById(roomId) {
    return games.find(game => game.roomId === roomId);
}

function removeGame(game) {
    let index = games.indexOf(game);
    if (index > -1) {
        games.splice(index, 1);
    }
}

io.on('connection', socket => {
    socket.on('send-move', move => {
        const game = getGameByPlayer(socket.id);
        
        if (game === undefined) {
            return;
        } else if (game.gameOver) {
            return;
        } else if (game.white === socket.id && game.board.turn !== dammen.Player.White) {
            return;
        } else if (game.black === socket.id && game.board.turn !== dammen.Player.Black) {
            return;
        }
    
        game.board.move(move);
        io.to(game.roomId).emit('receive-move', game.board.boardArray, game.board.turn, game.board.takeIndex);
        if (game.board.gameOver()) {
            let winner = game.board.turn === dammen.Player.Black ? "Red" : "Black";
            io.to(game.roomId).emit('game-over', winner + " won");
            game.gameOver = true;

            setTimeout(() => removeGame(game), 5000);
        }
    });

    socket.on('join-game', roomId => {
        const game = getGameById(roomId);

        if (game === undefined) {
            let board = new dammen.Dammen();
            if (Math.random() < 0.5) {
                games.push({
                    roomId: roomId,
                    white: socket.id,
                    board: board,
                    gameOver: false,
                    whiteDraw: false,
                    blackDraw: false,
                });
                io.to(socket.id).emit('join-success', dammen.Player.White);
            } else {
                games.push({
                    roomId: roomId,
                    black: socket.id,
                    board: board,
                    gameOver: false,
                    whiteDraw: false,
                    blackDraw: false,
                });
                io.to(socket.id).emit('join-success', dammen.Player.Black);
            }
        } else if (game.black !== socket.id && game.white !== socket.id) {
            if (game.white === undefined) {
                game.white = socket.id;
                io.to(socket.id).emit('join-success', dammen.Player.White);
            } else if (game.black === undefined) {
                game.black = socket.id;
                io.to(socket.id).emit('join-success', dammen.Player.Black);
            }
        }

        socket.join(roomId);
    });

    socket.on('disconnect', () => {
        const game = getGameByPlayer(socket.id);
        if (game === undefined) {
            return;
        }

        socket.to(game.roomId).emit('opponent-disconnect');
        let index = games.indexOf(game);

        games.splice(index, 1);
    });

    socket.on('resign', () => {
        const game = getGameByPlayer(socket.id);
        if (game === undefined || game.gameOver) {
            return;
        }

        if (game.black === socket.id) {
            io.to(game.roomId).emit('game-over', "Red won");
            game.gameOver = true;

            setTimeout(() => removeGame(game), 5000);
        } else if (game.white === socket.id) {
            io.to(game.roomId).emit('game-over', "Black won");
            game.gameOver = true;

            setTimeout(() => removeGame(game), 5000);
        }
    });

    socket.on('draw', () => {
        const game = getGameByPlayer(socket.id);
        if (game === undefined || game.gameOver) {
            return;
        }

        if (game.black === socket.id) {
            game.blackDraw = true;
            if (game.whiteDraw) {
                io.to(game.roomId).emit('game-over', "Draw");
                game.gameOver = true;
            }
        } else if (game.white === socket.id) {
            game.whiteDraw = true;
            if (game.blackDraw) {
                io.to(game.roomId).emit('game-over', "Draw");
                game.gameOver = true;
            }
        }
    });
});
