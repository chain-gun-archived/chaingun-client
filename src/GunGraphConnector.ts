import { GunEvent } from './GunEvent'

export class GunGraphConnector {
  graphData: GunEvent<GunGraphData>

  constructor() {
    this.graphData = new GunEvent(`${this.constructor}.graphData`)
  }

  request(souls: string[]) {}
}
