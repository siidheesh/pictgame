import React, { useState, useRef, useEffect } from "react";
import {
    BrowserRouter as Router,
    Switch,
    Route,
    Link,
    Redirect
  } from 'react-router-dom';

import App from './App';
import CanvasDraw from './CanavsDraw.jsx';
import GameUI from './gameui';

function Home(props: any) {

    const ROOM_ID_SS_KEY = "roomId";

    const [roomId, setRoomId] = useState(window.sessionStorage.getItem(ROOM_ID_SS_KEY));
    
    useEffect(() => {
        window.sessionStorage.setItem(ROOM_ID_SS_KEY, roomId ?? "");
    }, [roomId]);

    return (
        <Router>
            <div>
                <Route path="/canvas"><CanvasDraw /></Route>
            </div>
            <div><Route path="/app"><App /></Route></div>
            <div><Route path="/game"><GameUI /></Route></div>
        </Router>
    );
};

export default Home;