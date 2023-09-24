import { Component, OnInit, Input, Inject } from "@angular/core";
import { Event } from "../../models/event";
import { ActivatedRoute, Router } from "@angular/router";
import { EventService } from "src/app/events/event.service";
import { DomSanitizer } from "@angular/platform-browser";
import { map } from "rxjs";
import { Organizer } from "../../models/organizer";
import { OrganizerService } from "../../organizer.service";
import { switchMap } from "rxjs/operators";
import {
  openingTimesFormatter,
  dateTimesFormater,
} from "../logic/opening-times-format-helpers";
import { SessionStorageService } from "../session-storage/session-storage.service";

@Component({
  selector: "app-full-event",
  templateUrl: "./full-event.component.html",
  styleUrls: ["./full-event.component.css"],
})
export class FullEventComponent implements OnInit {
  currentPosition: Array<Number>;
  eventId: string;
  event: Event;
  organizer: Organizer;

  IconURL = null;
  ImageURL = null;
  gmapsUrl = "https://www.google.com/maps/search/";
  public openingTimesFormatter = openingTimesFormatter;
  public dateTimesFormater = dateTimesFormater;
  constructor(
    private route: ActivatedRoute,
    private eventService: EventService,
    private router: Router,
    private sessionStorageService: SessionStorageService,
    private organizerService: OrganizerService
  ) { }

  ngOnInit(): void {
    this.sessionStorageService.getLocation().subscribe(position => { this.currentPosition = position })
    this.route.params
      .pipe(
        map((eventIdParam) => eventIdParam["eventId"]),
        switchMap((eventId) => this.eventService.getEventById(eventId)),
        map((event) => (this.event = event[0])),
        switchMap((event) =>
          this.organizerService.getOrganizerById(event._organizerId)
        ),
        map((organizerResponse) => organizerResponse[0])
      )
      .subscribe((organizer) => {
        this.organizer = organizer;
        const adressStringUrl = encodeURIComponent(
          `${this.event.address?.street} ${this.event.address?.streetNumber} ${this.event.address?.city}`
        );
        this.gmapsUrl = `https://www.google.com/maps/search/?api=1&query=${adressStringUrl}`;
        this.clearQueryParams();
      });

  }
  clearQueryParams() {
    this.router.navigate([], {
      queryParams: {},
      relativeTo: this.route,
      queryParamsHandling: "merge",
    });
  }
  addHttpProtocol(url: string): string {
    if (!url.startsWith("https://") && !url.startsWith("http://")) {
      return "https://" + url;
    }
    return url;
  }
}
