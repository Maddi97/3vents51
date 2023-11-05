import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { catchError, map, of, switchMap, tap } from 'rxjs';
import { CustomDialogComponent } from 'src/app/custom-dialog/custom-dialog.component';
import { Event } from 'src/app/models/event';
import { Organizer } from 'src/app/models/organizer';
import { EventsService } from 'src/app/services/events.web.service';
import { FileUploadService } from 'src/app/services/files/file-upload.service';
import { OrganizerObservableService } from '../../../services/organizer.observable.service';
import { SnackbarService } from '../../../services/utils/snackbar.service';
import { createEventForSpecificCrawler } from '../crawl-event.helpers';

@Component({
  selector: 'app-crawled-events-to-event',
  templateUrl: './crawled-events-to-event.component.html',
  styleUrls: ['./crawled-events-to-event.component.css']
})
export class CrawledEventsToEventComponent implements OnInit, OnChanges {
  @Input() eventIn: Partial<Event>;
  @Input() organizerIn: Organizer[];
  @Output() emitAddEvent: EventEmitter<any> = new EventEmitter<any>();
  @Output() emitNextEvent: EventEmitter<void> = new EventEmitter<void>();
  @Output() emitPreviousEvent: EventEmitter<void> = new EventEmitter<void>();

  shouldInputOrganizer = false;
  inputOrganizer: Organizer;
  inputEvent: Event = new Event();
  shouldInputEvent = false;

  // subscriptions
  category$
  categories
  organizer$;
  createOrganizer$;
  updateOrganizer$;
  deleteOrganizer$;
  eventImagePath = "images/eventImages/";


  constructor(
    private snackbar: SnackbarService,
    private eventService: EventsService,
    private fileService: FileUploadService,
    public dialog: MatDialog,
    private organizerOnservableService: OrganizerObservableService


  ) {

  }

  ngOnInit(): void {
    this.findOrganizer()
  }
  ngOnChanges(changes: SimpleChanges): void {
    this.findOrganizer()
  }

  findOrganizer() {
    const filteredOrganizer = this.organizerIn.filter((organizer) =>
      organizer.name.toLowerCase() === this.eventIn.organizerName.toLowerCase()
    );
    if (filteredOrganizer.length < 1) {
      this.inputOrganizer = new Organizer()
      this.inputOrganizer.name = this.eventIn.organizerName
      this.shouldInputOrganizer = true
      this.shouldInputEvent = false

    }
    else {

      this.inputOrganizer = filteredOrganizer[0]
      //todo Event befüllen
      this.inputEvent = new Event();
      this.inputEvent = this.createInputEvent()
      this.shouldInputEvent = true
      this.shouldInputOrganizer = false
    }
  }
  nextEvent() {
    this.emitNextEvent.emit();
  }
  previousEvent() {
    this.emitPreviousEvent.emit();
  }

  addNewOrganizer(organizer) {
    this.organizerOnservableService.addNewOrganizer(organizer).then(
      (organizerResponse) => {
        this.organizerIn.push(organizerResponse)
        this.findOrganizer()
        this.snackbar.openSnackBar('Successfully added: ' + organizerResponse.name, 'success')
      }
    ).catch(
      (error) => this.snackbar.openSnackBar(error, 'error')
    )
  }

  addEventCheckDuplicate(event) {
    this.eventService
      .checkIfEventsExistsInDB(event)
      .pipe(
        map((existingEvents) => {
          if (existingEvents.length > 0) {
            this.openDialogIfDuplicate(existingEvents, event);
            this.emitNextEvent.emit()
          } else {
            this.addNewEvent(event);
          }
        }),
        catchError((error) => {
          console.error('Error checking duplicate', error);
          this.snackbar.openSnackBar(error.message, "error")
          return of(null); // Continue with null eventImagePath
        }),
      ).subscribe();
  }

  openDialogIfDuplicate(events: Event[], event) {
    const dialogRef = this.dialog.open(CustomDialogComponent, {
      data: { currentEvent: event, events: events },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.addNewEvent(event);
      } else {
        this.snackbar.openSnackBar("Event not added " + event.name, "error");
      }
    });
  }
  addNewEvent(event) {
    // set _id undefined otherwise error occurs
    event._id = undefined;

    this.eventService
      .createEvent(event)
      .pipe(
        switchMap((createEventResponse) => {
          event._id = createEventResponse._id;
          const formdata = event.fd;
          delete event.fd;
          if (formdata !== undefined) {
            const fullEventImagePath =
              this.eventImagePath + createEventResponse._id;
            formdata.append("eventImagePath", fullEventImagePath);
            return this.fileService.uploadEventImage(formdata).pipe(
              catchError((uploadImageError) => {
                console.error('Error uploading event image:', uploadImageError);
                this.snackbar.openSnackBar(uploadImageError.message, "error")
                return of(null); // Continue with null eventImagePath
              }),
              tap((uploadImageResponse) => {
                if (uploadImageResponse) {
                  event.eventImagePath = uploadImageResponse.eventImage.path;
                }
              })
            );
          }
          return of(null); // Continue with null eventImagePath
        }),
        switchMap((eventWithImagePath) => {
          return this.eventService.updateEvent(
            event._organizerId,
            event._id,
            event
          ).pipe(
            catchError((updateEventError) => {
              console.error('Error updating event:', updateEventError);
              this.snackbar.openSnackBar(updateEventError.message, "error")
              return of(null); // Continue without showing success message
            }),
            tap(() => {
              this.emitAddEvent.emit(this.eventIn);
              this.snackbar.openSnackBar(
                "Successfully added Event: " + event.name,
                "success"
              );
            })
          );
        })
      )
      .subscribe(
        () => {
          // Success
        },
        (error) => {
          console.error('Error:', error);
          this.snackbar.openSnackBar(error.message, "error")

          // Handle error here, e.g., show an error message to the user.
        }
      );
  }
  createInputEvent(): Event {
    return createEventForSpecificCrawler('urbanite', this.eventIn, this.inputOrganizer)
  }
}
