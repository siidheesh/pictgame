# PictBot 🤖 (beta)

A simple bot microservice that matches and plays with clients that have been waiting for a while

Try it out at https://pg.siid.sh

# How

It hooks onto the client channel to intercept match requests and communicate with clients.
When a client sends its third match request, the bot'll ask to match with them. No state machine is implemented, and consequently the bot can play with any number of clients simultaneously (in theory...)

For the moment, it merely sends back the picture it receives. To be updated

# Why

So others can try out the multiplayer mode without having to explicitly open another tab.

It also serves as a stepping stone towards future integration testing (minus the websocket layer) as it's essentially a standalone client
