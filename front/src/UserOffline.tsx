import { Button, Dialog, Typography } from "@material-ui/core";
import React from "react";

const UserOffline = React.memo((props: any) => (
  <Dialog open={props.open} aria-labelledby="" aria-describedby="">
    <div className="center m20">
      <div className="center-text mb20">
        <Typography variant="h6">Lost connection with server!</Typography>
      </div>
      <div className="center-row wrap">
        <Button onClick={props.onSinglePlayer}>Single-player mode</Button>
        <Button onClick={props.onQuit}>Quit</Button>
      </div>
    </div>
  </Dialog>
));

export default UserOffline;
